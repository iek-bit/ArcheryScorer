export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request.headers.get('Origin'))
      });
    }

    if (url.pathname === '/photo-score/health') {
      return json(
        {
          ok: true,
          roboflowConfigured: !!env.ROBOFLOW_API_KEY,
          project: env.ROBOFLOW_PROJECT || 'scorecard-detector',
          version: env.ROBOFLOW_MODEL_VERSION || '3'
        },
        200,
        request.headers.get('Origin')
      );
    }

    if (url.pathname !== '/photo-score/detect' || request.method !== 'POST') {
      return json({ error: 'Not found.' }, 404, request.headers.get('Origin'));
    }

    try {
      if (!env.ROBOFLOW_API_KEY) {
        return json({ error: 'ROBOFLOW_API_KEY secret is missing in Cloudflare.' }, 500, request.headers.get('Origin'));
      }

      const body = await request.json();
      const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
      const match = imageDataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
      if (!match) {
        return json({ error: 'Expected imageDataUrl to be a base64 data URL.' }, 400, request.headers.get('Origin'));
      }

      const project = env.ROBOFLOW_PROJECT || 'scorecard-detector';
      const version = env.ROBOFLOW_MODEL_VERSION || '3';
      const confidence = env.ROBOFLOW_CONFIDENCE || '0.4';
      const overlap = env.ROBOFLOW_OVERLAP || '0.3';
      const roboflowUrl = new URL(`https://serverless.roboflow.com/${encodeURIComponent(project)}/${encodeURIComponent(version)}`);
      roboflowUrl.searchParams.set('api_key', env.ROBOFLOW_API_KEY);
      roboflowUrl.searchParams.set('confidence', confidence);
      roboflowUrl.searchParams.set('overlap', overlap);
      roboflowUrl.searchParams.set('image_type', 'base64');

      const roboflowResponse = await fetch(roboflowUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: match[1]
      });

      const responseText = await roboflowResponse.text();
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = null;
      }

      if (!roboflowResponse.ok || !payload) {
        return json(
          {
            error: 'Roboflow did not return valid JSON.',
            details: responseText.slice(0, 500)
          },
          502,
          request.headers.get('Origin')
        );
      }

      const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
      const prediction = predictions
        .filter(item => item && typeof item === 'object')
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0] || null;

      return json(
        {
          ok: true,
          image: payload.image || null,
          prediction,
          predictionsCount: predictions.length
        },
        200,
        request.headers.get('Origin')
      );
    } catch (error) {
      return json(
        { error: error?.message || 'Worker error.' },
        500,
        request.headers.get('Origin')
      );
    }
  }
};

function json(payload, status = 200, origin = '') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin)
    }
  });
}

function corsHeaders(origin = '') {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Club-Secret'
  };
}

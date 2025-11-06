import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyToFlask(request, params.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyToFlask(request, params.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyToFlask(request, params.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyToFlask(request, params.path);
}

async function proxyToFlask(request: NextRequest, path: string[]) {
  try {
    const apiPath = path.join('/');
    const url = `${FLASK_API_URL}/api/${apiPath}${request.nextUrl.search}`;

    // Diagnostic logging
    console.log(`[CATCH-ALL] ${request.method} /api/${apiPath}`);
    console.log(`[CATCH-ALL] Proxying to: ${url}`);

    // Forward the request body if it exists
    let body = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text();
    }

    // Forward headers, especially cookies for session auth
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Skip host header
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
      credentials: 'include',
    });

    // Get response body
    const responseBody = await response.text();

    // Create response with same status and headers
    const nextResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    });

    // Forward response headers, especially set-cookie for session
    response.headers.forEach((value, key) => {
      nextResponse.headers.set(key, value);
    });

    return nextResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy request failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

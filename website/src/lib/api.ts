/**
 * API Client for KAS Backend
 * Handles spec generation with SSE streaming
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7131';

export interface GenerateProgressEvent {
  type: 'progress';
  step: number;
  message: string;
  subtitle: string;
}

export interface GenerateCompleteEvent {
  type: 'complete';
  specId: string;
  spec: Record<string, unknown>;
}

export interface GenerateErrorEvent {
  type: 'error';
  error: string;
}

export type GenerateEvent = GenerateProgressEvent | GenerateCompleteEvent | GenerateErrorEvent;

export interface GenerateOptions {
  businessName: string;
  businessDescription: string;
  onProgress: (event: GenerateProgressEvent) => void;
  onComplete: (event: GenerateCompleteEvent) => void;
  onError: (error: string) => void;
}

/**
 * Generate a spec using SSE streaming for progress updates
 */
export async function generateSpec({
  businessName,
  businessDescription,
  onProgress,
  onComplete,
  onError,
}: GenerateOptions): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/specs/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        business_name: businessName,
        business_description: businessDescription,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');

    // SSE streaming response
    if (contentType?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: GenerateEvent = JSON.parse(line.slice(6));

              if (event.type === 'progress') {
                onProgress(event);
              } else if (event.type === 'complete') {
                onComplete(event);
                return;
              } else if (event.type === 'error') {
                onError(event.error);
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', line);
            }
          }
        }
      }
    } else {
      // Fallback: JSON response (non-streaming)
      const data = await response.json();

      // Simulate progress steps
      for (let step = 1; step <= 4; step++) {
        onProgress({
          type: 'progress',
          step,
          message: `Step ${step}...`,
          subtitle: 'Processing',
        });
        await new Promise((r) => setTimeout(r, 500));
      }

      if (data.success && data.data) {
        onComplete({
          type: 'complete',
          specId: data.data.id,
          spec: data.data.spec,
        });
      } else {
        onError(data.error || 'Generation failed');
      }
    }
  } catch (error: any) {
    console.error('Generate error:', error);
    onError(error.message || 'Failed to generate app');
  }
}

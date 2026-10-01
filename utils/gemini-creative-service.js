const { GoogleGenAI, GenerateVideosOperation, Modality } = require('@google/genai');

class GeminiCreativeService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.ai = null;
    if (this.apiKey) {
      this.ai = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
  }

  isAvailable() {
    return Boolean(this.ai || process.env.GEMINI_API_KEY);
  }

  getAI() {
    if (!this.ai) {
      const key = this.apiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error('GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or Secrets.');
      }
      this.apiKey = key;
      this.ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return this.ai;
  }

  /**
   * Veo 3 Video Generation
   * Model: veo-3.1-fast-generate-preview
   * Aspect Ratio: 16:9 (landscape) or 9:16 (portrait)
   */
  async startVideoGeneration({ prompt, aspectRatio = '16:9', resolution = '720p' }) {
    const ai = this.getAI();
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required for video generation');
    }

    const validRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    const validResolution = resolution === '1080p' ? '1080p' : '720p';

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt.trim(),
      config: {
        numberOfVideos: 1,
        resolution: validResolution,
        aspectRatio: validRatio
      }
    });

    return {
      operationName: operation.name,
      model: 'veo-3.1-fast-generate-preview',
      aspectRatio: validRatio,
      resolution: validResolution
    };
  }

  /**
   * Poll Veo video generation status
   */
  async getVideoStatus(operationName) {
    const ai = this.getAI();
    if (!operationName) {
      throw new Error('operationName is required to check video status');
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const isDone = Boolean(updated.done);
    let videoUri = null;
    if (isDone && updated.response?.generatedVideos?.[0]?.video?.uri) {
      videoUri = updated.response.generatedVideos[0].video.uri;
    }

    return {
      done: isDone,
      operationName,
      videoUri,
      error: updated.error || null
    };
  }

  /**
   * Search Grounding using Google Search
   * Model: gemini-3.5-flash with googleSearch tool
   */
  async searchGrounding({ query, prompt, systemInstruction }) {
    const ai = this.getAI();
    const contents = prompt || query || 'Provide recent trending YouTube ideas and factual search insights';

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: systemInstruction || 'You are an elite YouTube trend researcher and audience strategist. Use Google Search grounding to deliver verified, up-to-date facts, current trends, and audience demand metrics.',
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;

    return {
      text,
      model: 'gemini-3.5-flash',
      groundingMetadata
    };
  }

  /**
   * Create or Edit Images
   * Model: gemini-3.1-flash-image-preview
   */
  async generateOrEditImage({ prompt, inputImageBase64, mimeType = 'image/png', aspectRatio = '16:9' }) {
    const ai = this.getAI();
    if (!prompt) {
      throw new Error('Prompt is required for image creation/editing');
    }

    let contents;
    if (inputImageBase64) {
      // Clean base64 string if data URL prefix was passed
      const cleanBase64 = inputImageBase64.replace(/^data:[^;]+;base64,/, '');
      contents = {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'image/png'
            }
          },
          { text: prompt }
        ]
      };
    } else {
      contents = {
        parts: [
          { text: prompt }
        ]
      };
    }

    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const chosenRatio = validRatios.includes(aspectRatio) ? aspectRatio : '16:9';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents,
      config: {
        imageConfig: {
          aspectRatio: chosenRatio
        }
      }
    });

    let imageUrl = null;
    let description = '';

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const type = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${type};base64,${part.inlineData.data}`;
      } else if (part.text) {
        description += (description ? '\n' : '') + part.text;
      }
    }

    if (!imageUrl) {
      throw new Error('The model did not return image data. Try refining the prompt.');
    }

    return {
      imageUrl,
      description,
      model: 'gemini-3.1-flash-image-preview',
      aspectRatio: chosenRatio,
      isEdit: Boolean(inputImageBase64)
    };
  }

  /**
   * Generate Music
   * Models: lyria-3-clip-preview (up to 30s clips) or lyria-3-pro-preview (full tracks)
   */
  async generateMusic({ prompt, trackType = 'clip' }) {
    const ai = this.getAI();
    if (!prompt) {
      throw new Error('Prompt is required for music generation');
    }

    const model = trackType === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        responseModalities: [Modality.AUDIO]
      }
    });

    let audioBase64 = '';
    let mimeType = 'audio/wav';
    let lyrics = '';

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    if (!audioBase64) {
      throw new Error('No audio returned by Lyria music model. Please try again with a descriptive musical style or genre prompt.');
    }

    return {
      audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
      mimeType,
      lyrics,
      model,
      trackType
    };
  }
}

module.exports = { GeminiCreativeService };

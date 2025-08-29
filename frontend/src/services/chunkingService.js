export const chunkingStrategies = [
  {
    id: 'sentence',
    name: '문장 기반 (Sentence-based)',
    description: '문장 단위로 텍스트를 분할하는 기본 전략',
    defaultSize: 512,
    defaultOverlap: 50,
    sizeRange: { min: 256, max: 2048 },
    features: ['문맥 보존', '자연스러운 분할', '빠른 처리'],
    recommended: true
  },
  {
    id: 'fixed',
    name: '고정 크기 (Fixed Size)',
    description: '일정한 토큰 수로 균등하게 분할',
    defaultSize: 512,
    defaultOverlap: 50,
    sizeRange: { min: 256, max: 2048 },
    features: ['예측 가능한 크기', '균등 분할', '효율적 저장']
  },
  {
    id: 'paragraph',
    name: '단락 기반 (Paragraph-based)',
    description: '단락 단위로 문서를 분할하는 전략',
    defaultSize: 768,
    defaultOverlap: 75,
    sizeRange: { min: 512, max: 4096 },
    features: ['논리적 구조 유지', '문단 보존', '중간 크기 청크']
  },
  {
    id: 'semantic',
    name: '의미 기반 (Semantic)',
    description: '내용의 의미적 경계를 고려한 지능형 분할',
    defaultSize: 1024,
    defaultOverlap: 128,
    sizeRange: { min: 512, max: 2048 },
    features: ['문맥 최적화', '의미 보존', '고품질 검색']
  },
  {
    id: 'sliding',
    name: '슬라이딩 윈도우 (Sliding Window)',
    description: '겹치는 구간으로 연속적 분할',
    defaultSize: 512,
    defaultOverlap: 256,
    sizeRange: { min: 256, max: 1536 },
    features: ['높은 중첩', '정보 손실 최소화', '세밀한 검색']
  }
];

export const countTokens = (text) => {
  const words = text.match(/\b\w+\b/g) || [];
  const punctuation = text.match(/[.,;:!?()-]/g) || [];
  const numbers = text.match(/\b\d+\b/g) || [];
  
  let tokenCount = words.length;
  tokenCount += Math.ceil(punctuation.length / 2.5);
  tokenCount += Math.floor(numbers.length * 0.7);
  
  const longWords = words.filter(w => w.length > 6).length;
  tokenCount += Math.floor(longWords * 0.3);
  
  return Math.max(1, Math.round(tokenCount));
};

const splitIntoSentences = (text) => {
  return text
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1|SENTENCE_BREAK|')
    .replace(/([.!?])\s*$/g, '$1|SENTENCE_BREAK|')
    .split('|SENTENCE_BREAK|')
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());
};

const calculateSentenceCompleteness = (text) => {
  const sentences = splitIntoSentences(text);
  const completeSentences = sentences.filter(s => /[.!?]$/.test(s.trim())).length;
  return sentences.length > 0 ? completeSentences / sentences.length : 0;
};

const calculateParagraphCoherence = (text) => {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const uniqueWords = new Set(words);
  const repetitionRatio = words.length > 0 ? (words.length - uniqueWords.size) / words.length : 0;
  return Math.min(1.0, repetitionRatio * 3);
};

const findSemanticBreakPoint = (sentenceBuffer, targetSize) => {
  let bestBreak = Math.floor(sentenceBuffer.length / 2);
  let currentTokens = 0;
  
  for (let i = 0; i < sentenceBuffer.length; i++) {
    currentTokens += sentenceBuffer[i].tokens;
    if (currentTokens >= targetSize * 0.8) {
      bestBreak = i + 1;
      break;
    }
  }
  
  return Math.min(bestBreak, sentenceBuffer.length);
};

const calculateSemanticCoherence = (text) => {
  const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const wordFreq = {};
  words.forEach(word => wordFreq[word] = (wordFreq[word] || 0) + 1);
  
  const repeatedWords = Object.values(wordFreq).filter(freq => freq > 1).length;
  return Math.min(1.0, (repeatedWords / Math.max(1, Object.keys(wordFreq).length)) * 2);
};

const extractTopicKeywords = (text) => {
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const wordFreq = {};
  
  words.forEach(word => {
    if (!isStopWord(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
};

const calculateSemanticDensity = (text) => {
  const sentences = splitIntoSentences(text);
  const avgWordsPerSentence = sentences.reduce((sum, s) => 
    sum + (s.match(/\b\w+\b/g) || []).length, 0) / Math.max(1, sentences.length);
  
  return Math.min(1.0, avgWordsPerSentence / 20);
};

const isStopWord = (word) => {
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 
    'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 
    'by', 'from', 'they', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 
    'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 
    'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 
    'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 
    'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 
    'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 
    'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 
    'because', 'any', 'these', 'give', 'day', 'most', 'us'
  ]);
  return stopWords.has(word.toLowerCase());
};

const findOverlapText = (prevText, currentText) => {
  const prevWords = prevText.split(/\s+/);
  const currentWords = currentText.split(/\s+/);
  
  let overlapLength = 0;
  for (let i = 1; i <= Math.min(prevWords.length, currentWords.length); i++) {
    const prevSuffix = prevWords.slice(-i).join(' ');
    const currentPrefix = currentWords.slice(0, i).join(' ');
    if (prevSuffix === currentPrefix) {
      overlapLength = i;
    }
  }
  
  return overlapLength > 0 ? currentWords.slice(0, overlapLength).join(' ') : '';
};

export const chunkByFixedSize = (text, size, overlap) => {
  const chunks = [];
  let currentPosition = 0;
  
  while (currentPosition < text.length) {
    // Extract chunk of 'size' characters
    let endPosition = Math.min(currentPosition + size, text.length);
    let currentChunk = text.substring(currentPosition, endPosition);
    
    // Try to break at word boundary if not at end of text
    if (endPosition < text.length && currentChunk.length === size) {
      const lastSpaceIndex = currentChunk.lastIndexOf(' ');
      if (lastSpaceIndex > size * 0.8) { // Only break if we're at least 80% through
        currentChunk = currentChunk.substring(0, lastSpaceIndex);
        endPosition = currentPosition + lastSpaceIndex;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: countTokens(currentChunk.trim()), // Still calculate tokens for display
        characters: currentChunk.trim().length,
        words: currentChunk.trim().split(/\s+/).length,
        start_char: currentPosition,
        end_char: endPosition,
        type: 'fixed-size'
      });
    }
    
    // Calculate next position with overlap
    if (overlap > 0 && endPosition < text.length) {
      // Move forward by (size - overlap) characters
      currentPosition = endPosition - overlap;
      
      // Try to find a word boundary for the overlap start
      if (currentPosition > 0 && currentPosition < text.length) {
        const nearbyText = text.substring(Math.max(0, currentPosition - 10), Math.min(text.length, currentPosition + 10));
        const spaceIndex = nearbyText.indexOf(' ', 10);
        if (spaceIndex !== -1 && spaceIndex < 15) {
          currentPosition = currentPosition - 10 + spaceIndex + 1;
        }
      }
    } else {
      currentPosition = endPosition;
    }
    
    // Safety check to prevent infinite loops
    if (currentPosition === endPosition - size) {
      currentPosition = endPosition;
    }
  }
  
  return chunks;
};

export const chunkBySentence = (text, size, overlap) => {
  const sentences = splitIntoSentences(text);
  const chunks = [];
  let currentChunk = '';
  let sentenceIndices = [];
  let currentChars = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const sentenceChars = sentence.length;
    
    // Check if adding this sentence would exceed the character limit
    if (currentChars + sentenceChars + (currentChunk ? 1 : 0) > size && currentChunk) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: countTokens(currentChunk.trim()), // Still calculate tokens for display
        characters: currentChunk.trim().length,
        sentences: sentenceIndices.length,
        sentence_range: `${sentenceIndices[0] + 1}-${sentenceIndices[sentenceIndices.length - 1] + 1}`,
        type: 'sentence-boundary',
        completeness: calculateSentenceCompleteness(currentChunk)
      });
      
      // Calculate overlap based on characters
      let overlapChars = 0;
      let overlapStart = sentenceIndices.length;
      
      // Find how many sentences to include for overlap
      for (let j = sentenceIndices.length - 1; j >= 0; j--) {
        const overlapSentence = sentences[sentenceIndices[j]];
        overlapChars += overlapSentence.length;
        if (overlapChars >= overlap) {
          overlapStart = j;
          break;
        }
      }
      
      if (overlapStart < sentenceIndices.length) {
        // Create overlap from previous chunk
        const overlapSentences = sentenceIndices.slice(overlapStart).map(idx => sentences[idx]);
        currentChunk = overlapSentences.join(' ') + ' ' + sentence;
        sentenceIndices = sentenceIndices.slice(overlapStart).concat([i]);
        currentChars = currentChunk.length;
      } else {
        currentChunk = sentence;
        sentenceIndices = [i];
        currentChars = sentenceChars;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      sentenceIndices.push(i);
      currentChars = currentChunk.length;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: chunks.length + 1,
      text: currentChunk.trim(),
      tokens: countTokens(currentChunk.trim()), // Still calculate tokens for display
      characters: currentChunk.trim().length,
      sentences: sentenceIndices.length,
      sentence_range: `${sentenceIndices[0] + 1}-${sentenceIndices[sentenceIndices.length - 1] + 1}`,
      type: 'sentence-boundary',
      completeness: calculateSentenceCompleteness(currentChunk)
    });
  }

  return chunks;
};

export const chunkByParagraph = (text, size, overlap) => {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  const chunks = [];
  let currentChunk = '';
  let paragraphIndices = [];
  let currentChars = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    const paragraphChars = paragraph.length;
    const separator = currentChunk ? '\n\n' : '';
    
    if (currentChars + separator.length + paragraphChars > size && currentChunk) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: countTokens(currentChunk.trim()), // Still calculate tokens for display
        characters: currentChunk.trim().length,
        paragraphs: paragraphIndices.length,
        paragraph_range: `${paragraphIndices[0] + 1}-${paragraphIndices[paragraphIndices.length - 1] + 1}`,
        type: 'paragraph-boundary',
        coherence: calculateParagraphCoherence(currentChunk)
      });
      
      // Calculate overlap based on characters
      let overlapChars = 0;
      let overlapStart = paragraphIndices.length;
      
      // Find how many paragraphs to include for overlap
      for (let j = paragraphIndices.length - 1; j >= 0; j--) {
        const overlapPara = paragraphs[paragraphIndices[j]];
        overlapChars += overlapPara.length + (j < paragraphIndices.length - 1 ? 2 : 0); // Account for \n\n
        if (overlapChars >= overlap) {
          overlapStart = j;
          break;
        }
      }
      
      if (overlapStart < paragraphIndices.length) {
        const overlapParagraphs = paragraphIndices.slice(overlapStart).map(idx => paragraphs[idx]);
        currentChunk = overlapParagraphs.join('\n\n') + '\n\n' + paragraph;
        paragraphIndices = paragraphIndices.slice(overlapStart).concat([i]);
        currentChars = currentChunk.length;
      } else {
        currentChunk = paragraph;
        paragraphIndices = [i];
        currentChars = paragraphChars;
      }
    } else {
      currentChunk += separator + paragraph;
      paragraphIndices.push(i);
      currentChars = currentChunk.length;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: chunks.length + 1,
      text: currentChunk.trim(),
      tokens: countTokens(currentChunk.trim()), // Still calculate tokens for display
      characters: currentChunk.trim().length,
      paragraphs: paragraphIndices.length,
      paragraph_range: `${paragraphIndices[0] + 1}-${paragraphIndices[paragraphIndices.length - 1] + 1}`,
      type: 'paragraph-boundary',
      coherence: calculateParagraphCoherence(currentChunk)
    });
  }

  return chunks;
};

export const chunkBySemantic = (text, size, overlap) => {
  const sentences = splitIntoSentences(text);
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;
  let sentenceBuffer = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const sentenceTokens = countTokens(sentence);
    
    sentenceBuffer.push({ text: sentence, tokens: sentenceTokens, index: i });
    
    if (currentTokens + sentenceTokens > size && currentChunk) {
      const breakPoint = findSemanticBreakPoint(sentenceBuffer, size);
      
      const chunkSentences = sentenceBuffer.slice(0, breakPoint);
      const chunkContent = chunkSentences.map(s => s.text).join(' ');
      
      chunks.push({
        id: chunks.length + 1,
        text: chunkContent.trim(),
        tokens: countTokens(chunkContent),
        sentences: chunkSentences.length,
        type: 'semantic',
        coherence_score: calculateSemanticCoherence(chunkContent),
        topic_keywords: extractTopicKeywords(chunkContent),
        semantic_density: calculateSemanticDensity(chunkContent)
      });
      
      const overlapSize = Math.min(overlap, Math.floor(chunkSentences.length / 2));
      sentenceBuffer = sentenceBuffer.slice(breakPoint - overlapSize);
      currentChunk = sentenceBuffer.map(s => s.text).join(' ');
      currentTokens = countTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: chunks.length + 1,
      text: currentChunk.trim(),
      tokens: currentTokens,
      sentences: sentenceBuffer.length,
      type: 'semantic',
      coherence_score: calculateSemanticCoherence(currentChunk),
      topic_keywords: extractTopicKeywords(currentChunk),
      semantic_density: calculateSemanticDensity(currentChunk)
    });
  }

  return chunks;
};

export const chunkBySlidingWindow = (text, size, overlap) => {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentPosition = 0;
  
  while (currentPosition < words.length) {
    let currentChunk = '';
    let currentTokens = 0;
    let wordsInChunk = 0;
    let startPosition = currentPosition;
    
    while (currentPosition < words.length && currentTokens < size) {
      const nextWord = words[currentPosition];
      const nextWordTokens = countTokens(nextWord);
      
      if (currentTokens + nextWordTokens <= size) {
        currentChunk += (currentChunk ? ' ' : '') + nextWord;
        currentTokens += nextWordTokens;
        wordsInChunk++;
        currentPosition++;
      } else {
        break;
      }
    }
    
    if (currentChunk.trim() && currentTokens >= Math.floor(size * 0.3)) {
      let actualOverlapTokens = 0;
      if (chunks.length > 0 && overlap > 0) {
        const prevChunk = chunks[chunks.length - 1];
        const overlapText = findOverlapText(prevChunk.text, currentChunk);
        actualOverlapTokens = countTokens(overlapText);
      }
      
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: currentTokens,
        words: wordsInChunk,
        start_word: startPosition,
        end_word: currentPosition,
        overlap_tokens: actualOverlapTokens,
        overlap_percentage: actualOverlapTokens > 0 ? Math.round((actualOverlapTokens / currentTokens) * 100) : 0,
        type: 'sliding-window',
        window_position: `${startPosition + 1}-${currentPosition}/${words.length}`,
        completeness: currentTokens >= size ? 1.0 : currentTokens / size
      });
    }
    
    if (overlap > 0 && currentTokens > overlap) {
      let targetOverlapTokens = Math.min(overlap, Math.floor(currentTokens * 0.8));
      let overlapWords = Math.floor(wordsInChunk * (targetOverlapTokens / currentTokens));
      overlapWords = Math.max(1, Math.min(overlapWords, wordsInChunk - 1));
      
      currentPosition = Math.max(startPosition + 1, currentPosition - overlapWords);
    } else {
      let stepWords = Math.max(1, Math.floor(wordsInChunk / 2));
      currentPosition = startPosition + stepWords;
    }
    
    if (currentPosition <= startPosition) {
      currentPosition = startPosition + 1;
    }
  }

  return chunks;
};

export const generatePreviewChunks = (text, strategy, size, overlap) => {
  if (!text || !strategy) {
    console.warn('Missing text or strategy for chunking preview');
    return [];
  }

  let chunks = [];

  try {
    switch (strategy.id) {
      case 'sentence':
        chunks = chunkBySentence(text, size, overlap);
        break;
      case 'paragraph':
        chunks = chunkByParagraph(text, size, overlap);
        break;
      case 'semantic':
        chunks = chunkBySemantic(text, size, overlap);
        break;
      case 'sliding':
        chunks = chunkBySlidingWindow(text, size, overlap);
        break;
      case 'fixed':
      default:
        chunks = chunkByFixedSize(text, size, overlap);
        break;
    }

    console.log('Generated chunks:', {
      totalChunks: chunks.length,
      strategyUsed: strategy.id,
      targetSize: size,
      targetOverlap: overlap,
      avgTokens: chunks.length > 0 ? Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length) : 0
    });

    return chunks;
  } catch (error) {
    console.error('Error generating preview chunks:', error);
    return [];
  }
};

export const calculateAverageQuality = (chunks, chunkSize) => {
  if (!chunks || chunks.length === 0) return 0;

  let totalQuality = 0;
  let qualityCount = 0;

  chunks.forEach(chunk => {
    let chunkQuality = 0;
    let metrics = 0;

    if (chunk.completeness !== undefined) {
      chunkQuality += chunk.completeness;
      metrics++;
    }

    if (chunk.coherence !== undefined) {
      chunkQuality += chunk.coherence;
      metrics++;
    }
    if (chunk.coherence_score !== undefined) {
      chunkQuality += chunk.coherence_score;
      metrics++;
    }

    if (chunk.semantic_density !== undefined) {
      chunkQuality += chunk.semantic_density;
      metrics++;
    }

    if (chunk.tokens && chunkSize) {
      const tokenRatio = Math.min(chunk.tokens / chunkSize, chunkSize / chunk.tokens);
      chunkQuality += tokenRatio;
      metrics++;
    }

    if (metrics > 0) {
      totalQuality += chunkQuality / metrics;
      qualityCount++;
    }
  });

  return qualityCount > 0 ? totalQuality / qualityCount : 0;
};

export const getStrategyInsights = (chunks, strategy) => {
  if (!chunks || !strategy) return [];

  const insights = [];
  const avgTokens = chunks.reduce((sum, c) => sum + (c.tokens || 0), 0) / chunks.length;
  const tokenVariance = chunks.reduce((sum, c) => sum + Math.pow((c.tokens || 0) - avgTokens, 2), 0) / chunks.length;
  const consistency = Math.max(0, 1 - (Math.sqrt(tokenVariance) / avgTokens));

  switch (strategy.id) {
    case 'sentence':
      const avgSentences = chunks
        .filter(c => c.sentences)
        .reduce((sum, c) => sum + c.sentences, 0) / chunks.filter(c => c.sentences).length;
      
      const avgCompleteness = chunks
        .filter(c => c.completeness !== undefined)
        .reduce((sum, c) => sum + c.completeness, 0) / chunks.filter(c => c.completeness !== undefined).length;

      insights.push(`청크당 평균 ${Math.round(avgSentences)}개 문장`);
      insights.push(`${Math.round(avgCompleteness * 100)}% 문장 경계 보존율`);
      if (consistency > 0.8) {
        insights.push(`청크 간 일관성 우수 (${Math.round(consistency * 100)}%)`);
      } else if (consistency > 0.6) {
        insights.push(`양호한 일관성, 일부 크기 변동 (${Math.round(consistency * 100)}%)`);
      } else {
        insights.push(`크기 변동 많음 - 매개변수 조정 권장 (${Math.round(consistency * 100)}%)`);
      }
      break;

    case 'paragraph':
      const avgParagraphs = chunks
        .filter(c => c.paragraphs)
        .reduce((sum, c) => sum + c.paragraphs, 0) / chunks.filter(c => c.paragraphs).length;
      
      const avgParagraphCoherence = chunks
        .filter(c => c.coherence !== undefined)
        .reduce((sum, c) => sum + c.coherence, 0) / chunks.filter(c => c.coherence !== undefined).length;

      insights.push(`청크당 평균 ${Math.round(avgParagraphs)}개 단락`);
      insights.push(`${Math.round(avgParagraphCoherence * 100)}% 내용 일관성 점수`);
      insights.push(`명확한 단락 구조를 가진 문서에 적합`);
      break;

    case 'semantic':
      const avgSemanticCoherence = chunks
        .filter(c => c.coherence_score !== undefined)
        .reduce((sum, c) => sum + c.coherence_score, 0) / chunks.filter(c => c.coherence_score !== undefined).length;
      
      const avgDensity = chunks
        .filter(c => c.semantic_density !== undefined)
        .reduce((sum, c) => sum + c.semantic_density, 0) / chunks.filter(c => c.semantic_density !== undefined).length;

      insights.push(`${Math.round(avgSemanticCoherence * 100)}% 의미적 일관성 점수`);
      insights.push(`${Math.round(avgDensity * 100)}% 정보 밀도`);
      
      const allKeywords = chunks.flatMap(c => c.topic_keywords || []);
      const uniqueKeywords = new Set(allKeywords);
      insights.push(`${uniqueKeywords.size}개의 고유 주제 키워드 식별`);
      break;

    case 'sliding':
      const avgOverlap = chunks
        .filter(c => c.overlap_percentage !== undefined && c.overlap_percentage > 0)
        .reduce((sum, c) => sum + c.overlap_percentage, 0) / chunks.filter(c => c.overlap_percentage !== undefined && c.overlap_percentage > 0).length;

      insights.push(`인접 청크 간 평균 ${Math.round(avgOverlap)}% 중첩`);
      insights.push(`${chunks.length}개의 겹치는 창으로 정보 보존 최대화`);
      insights.push(`포괄적 범위와 문맥 보존에 이상적`);
      break;

    case 'fixed':
      insights.push(`청크당 일관된 ${Math.round(avgTokens)}개 토큰 (±${Math.round(Math.sqrt(tokenVariance))})`);
      insights.push(`예측 가능한 크기로 효율적 처리 및 저장 가능`);
      if (consistency > 0.9) {
        insights.push(`우수한 균등성 - 일괄 처리에 최적`);
      } else {
        insights.push(`단어 경계로 인한 일부 변동 - 예상된 동작`);
      }
      break;

    default:
      insights.push(`${chunks.length}개 청크 생성, 평균 ${Math.round(avgTokens)}개 토큰`);
      insights.push(`토큰 일관성: ${Math.round(consistency * 100)}%`);
  }

  if (chunks.length < 3) {
    insights.push('⚠️ 청크 수가 매우 적음 - 더 세밀한 분할을 위해 청크 크기 축소 고려');
  } else if (chunks.length > 20) {
    insights.push('ℹ️ 많은 작은 청크들 - 효율성을 위해 크기 증가 고려');
  } else {
    insights.push(`✓ 효과적인 검색을 위한 적절한 청크 수 (${chunks.length}개)`);
  }

  return insights;
};
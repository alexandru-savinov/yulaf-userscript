/**
 * @file Language detection service using chrome.i18n.detectLanguage API.
 * Provides character-set validation and false-positive prevention.
 * @global
 */
window.LanguageDetector = {
  /** @type {string} */
  name: 'Universal Language Detector',

  // Language -> character set regex maps
  characterValidators: {
    // East Asian
    ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/, // Hiragana, Katakana, Kanji
    ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/, // Hangul
    zh: /[\u4E00-\u9FAF]/, // Chinese (general)
    'zh-cn': /[\u4E00-\u9FAF]/,
    'zh-tw': /[\u4E00-\u9FAF]/,

    // Cyrillic
    ru: /[\u0400-\u04FF]/,
    uk: /[\u0400-\u04FF]/,
    bg: /[\u0400-\u04FF]/,
    sr: /[\u0400-\u04FF]/,
    mk: /[\u0400-\u04FF]/,
    be: /[\u0400-\u04FF]/,

    // Arabic scripts
    ar: /[\u0600-\u06FF\u0750-\u077F]/,
    fa: /[\u0600-\u06FF\u0750-\u077F]/,
    ur: /[\u0600-\u06FF\u0750-\u077F]/,

    // Greek
    el: /[\u0370-\u03FF]/,

    // Hebrew
    he: /[\u0590-\u05FF]/,

    // Thai
    th: /[\u0E00-\u0E7F]/,

    // Devanagari (Hindi etc.)
    hi: /[\u0900-\u097F]/,
    ne: /[\u0900-\u097F]/,
    mr: /[\u0900-\u097F]/,

    // Dravidian languages
    ta: /[\u0B80-\u0BFF]/, // Tamil
    te: /[\u0C00-\u0C7F]/, // Telugu
    kn: /[\u0C80-\u0CFF]/, // Kannada
    ml: /[\u0D00-\u0D7F]/, // Malayalam

    // Indic languages
    gu: /[\u0A80-\u0AFF]/, // Gujarati
    bn: /[\u0980-\u09FF]/, // Bengali

    // Other scripts
    hy: /[\u0530-\u058F]/, // Armenian
    ka: /[\u10A0-\u10FF]/, // Georgian
    am: /[\u1200-\u137F]/, // Amharic (Ethiopian)
  },

  // Exclusion patterns to prevent false positives
  // e.g. when Turkish is selected, reject texts containing obvious English words
  exclusionPatterns: {
    tr: {
      excludedIf: 'en',
      patterns: [
        /\bthe\b/i,
        /\bwith\b/i,
        /\bfor\b/i,
        /\bwhat\b/i,
        /\bwhen\b/i,
        /\bhow\b/i,
        /\bthis\b/i,
        /\bthat\b/i,
        /\byou\b/i,
        /\byour\b/i,
        /\bare\b/i,
        /\bwas\b/i,
        /\bwere\b/i,
        /\bfrom\b/i,
        /\babout\b/i,
      ],
    },
    de: {
      excludedIf: 'en',
      patterns: [
        /\bthe\b/i,
        /\bwith\b/i,
        /\bthis\b/i,
        /\bthat\b/i,
        /\byou\b/i,
        /\byour\b/i,
        /\bwhat\b/i,
        /\bwhen\b/i,
      ],
    },
    ja: {
      excludedIf: 'ko',
      characterBased: true,
      patterns: [/[\uAC00-\uD7AF]/], // Reject if contains Hangul (Korean characters)
    },
    ko: {
      excludedIf: 'ja',
      characterBased: true,
      patterns: [/[\u3040-\u309F\u30A0-\u30FF]/], // Reject if contains Hiragana/Katakana
    },
  },

  /**
   * Check if text contains characters of a specific language script.
   * @param {string} text - Text to check
   * @param {string} langCode - Language code (e.g. 'ja', 'ko', 'zh')
   * @returns {boolean} True if text contains matching characters or no validator exists
   */
  hasLanguageCharacters(text, langCode) {
    const validator = this.characterValidators[langCode];
    if (!validator) {
      // No validator (Latin alphabet etc.), accept as valid
      return true;
    }
    return validator.test(text);
  },

  /**
   * Pre-screen: could the text potentially match any target language?
   * @param {string} text - Text to check
   * @param {string[]} targetLanguages - Array of target language codes
   * @returns {boolean} True if text could match at least one target language
   */
  couldMatchTargetLanguages(text, targetLanguages) {
    return targetLanguages.some(lang => {
      return !this.characterValidators[lang] || this.hasLanguageCharacters(text, lang);
    });
  },

  /**
   * Detect if text matches any of the target languages.
   * @param {string} text - Text to analyze
   * @param {string[]} targetLanguages - Array of target language codes
   * @param {boolean} [strictMode=true] - Whether to require high confidence
   * @returns {Promise<boolean>} True if text matches a target language
   */
  async detect(text, targetLanguages, strictMode = true) {
    if (!text || text.length < (window.YT_FILTER_CONSTANTS?.DETECTION?.MIN_TEXT_LENGTH || 3))
      return false;

    // Pre-screening (to reduce unnecessary API calls)
    if (!this.couldMatchTargetLanguages(text, targetLanguages)) {
      return false;
    }

    return this._detectImpl(text, targetLanguages, strictMode);
  },

  /**
   * Calculate the ratio of text matching exclusion patterns.
   * For word-based patterns (Latin languages): counts matching words / total words.
   * For character-based patterns (CJK): counts matching characters / total non-space characters.
   * @param {string} text - Text to check
   * @param {Object} exclusions - Exclusion config with patterns and optional characterBased flag
   * @returns {number} Ratio between 0 and 1
   */
  _calcExclusionRatio(text, exclusions) {
    if (exclusions.characterBased) {
      const chars = text.replace(/\s/g, '');
      if (chars.length === 0) return 0;
      let matchCount = 0;
      for (const ch of chars) {
        if (exclusions.patterns.some(p => p.test(ch))) matchCount++;
      }
      return matchCount / chars.length;
    }

    // Word-based: count how many words match any exclusion pattern
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;
    let matchCount = 0;
    for (const word of words) {
      if (exclusions.patterns.some(p => p.test(word))) matchCount++;
    }
    return matchCount / words.length;
  },

  /**
   * Check if a detected language code matches a target language code.
   * Handles subtags (e.g. 'zh-CN' matches target 'zh').
   * @param {string} detected - Detected language code from API
   * @param {string} target - Target language code
   * @returns {boolean}
   */
  _langMatches(detected, target) {
    return (
      detected === target ||
      detected.startsWith(target + '-') ||
      (detected.includes('-') && detected.split('-')[0] === target)
    );
  },

  /**
   * Internal detection implementation with timeout protection.
   * @param {string} text - Text to analyze
   * @param {string[]} targetLanguages - Array of target language codes
   * @param {boolean} strictMode - Whether to require high confidence
   * @returns {Promise<boolean>} True if text matches a target language
   */
  async _detectImpl(text, targetLanguages, strictMode) {
    try {
      if (chrome?.i18n?.detectLanguage) {
        const result = await Promise.race([
          new Promise(resolve => {
            chrome.i18n.detectLanguage(text, resolve);
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Detection timeout')),
              window.YT_FILTER_CONSTANTS?.DETECTION?.API_TIMEOUT || 3000
            )
          ),
        ]);

        if (result?.languages?.length > 0) {
          const top = result.languages[0];

          // Strict mode: reject if not reliable
          // Exception: Latin alphabet languages (like Turkish) often have low confidence
          // but can still be matched if percentage is reasonable
          if (strictMode && !result.isReliable) {
            const minPercentage =
              window.YT_FILTER_CONSTANTS?.DETECTION?.STRICT_MODE_MIN_PERCENTAGE || 50;
            const hasDecentConfidence = top.percentage > minPercentage;
            const matchesTarget = targetLanguages.some(lang =>
              this._langMatches(top.language, lang)
            );
            if (!hasDecentConfidence || !matchesTarget) {
              return false;
            }
          }

          // Check match against target languages
          return targetLanguages.some(targetLang => {
            const isMatch = this._langMatches(top.language, targetLang);

            if (isMatch) {
              // 1. Character set validation
              const detected = top.language;
              const base = detected.includes('-') ? detected.split('-')[0] : detected;

              if (
                !this.hasLanguageCharacters(text, detected) &&
                !this.hasLanguageCharacters(text, base)
              ) {
                return false;
              }

              // 2. Exclusion check (False Positive Guard)
              // Uses threshold approach: reject only if the ratio of matching
              // words/characters exceeds the threshold (default 50%)
              const exclusions = this.exclusionPatterns[base];
              if (exclusions) {
                const shouldCheck = !targetLanguages.includes(exclusions.excludedIf);
                if (shouldCheck) {
                  const ratio = this._calcExclusionRatio(text, exclusions);
                  const threshold =
                    window.YT_FILTER_CONSTANTS?.DETECTION?.EXCLUSION_RATIO_THRESHOLD || 0.5;
                  if (ratio > threshold) {
                    return false;
                  }
                }
              }
            }

            return isMatch;
          });
        }
      }
    } catch (err) {
      console.warn('[YuLaF] Language detection failed:', err.message || err);
    }

    return false;
  },
};

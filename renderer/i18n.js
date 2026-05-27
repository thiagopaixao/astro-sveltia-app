/**
 * i18n Module for Documental
 * Loads translations synchronously via IPC before Alpine initializes.
 * Provides window.__t(key, params) globally and Alpine.store('i18n') for reactivity.
 */
(function () {
  'use strict';

  // --- Synchronous initial load (BEFORE Alpine) ---
  var _currentLang = 'en';
  var _translations = {};
  var _fallbackTranslations = {};

  // Get saved locale — localStorage first (bulletproof), then IPC fallback
  var _urlLocale = 'en';
  try {
    var storedLocale = localStorage.getItem('appLocale');
    if (storedLocale) {
      _urlLocale = storedLocale;
    } else if (window.electronAPI && window.electronAPI.getAppLocaleSync) {
      _urlLocale = window.electronAPI.getAppLocaleSync() || 'en';
    }
  } catch (e) {}

  // Load translations synchronously (BEFORE Alpine)
  try {
    if (window.electronAPI && window.electronAPI.getTranslationsSync) {
      _fallbackTranslations = window.electronAPI.getTranslationsSync('en') || {};
      _translations = window.electronAPI.getTranslationsSync(_urlLocale) || _fallbackTranslations;
      _currentLang = _urlLocale;
    }
  } catch (e) {
    console.warn('i18n: Could not load translations synchronously:', e);
  }

  // --- Helper: dot-notation lookup ---
  function getByDotNotation(obj, key) {
    var parts = key.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  // --- Helper: string interpolation ---
  function interpolate(value, params) {
    if (!params || typeof value !== 'string') return value;
    var result = value;
    for (var param in params) {
      if (params.hasOwnProperty(param)) {
        result = result.replace(new RegExp('\\{' + param + '\\}', 'g'), String(params[param]));
      }
    }
    return result;
  }

  // --- Global translation function ---
  window.__t = function (key, params) {
    var value = getByDotNotation(_translations, key);
    if (value === undefined) {
      value = getByDotNotation(_fallbackTranslations, key);
    }
    if (value === undefined) {
      return key;
    }
    return interpolate(value, params);
  };

  // --- Alpine store registration ---
  document.addEventListener('alpine:init', function () {
    Alpine.store('i18n', {
      currentLang: _currentLang,
      // Reactive version counter — incremented on language change to trigger re-render
      _version: 0,

      t: function (key, params) {
        // Access _version to create reactive dependency
        void this._version;
        return window.__t(key, params);
      },

      changeLanguage: function (locale) {
        var self = this;

        // Try synchronous load first (production path via preload bridge)
        try {
          if (window.electronAPI && window.electronAPI.getTranslationsSync) {
            var newTranslations = window.electronAPI.getTranslationsSync(locale);
            if (newTranslations) {
              _translations = newTranslations;
              _currentLang = locale;
              self.currentLang = locale;
              self._version++;
              document.documentElement.lang = locale;
              if (window.electronAPI && window.electronAPI.setAppLocale) {
                window.electronAPI.setAppLocale(locale);
              }
              return Promise.resolve();
            }
          }
        } catch (e) {
          // Fall through to async fallback
        }

        // Fallback to async (test environment or missing sync bridge)
        return window.electronAPI.getTranslations(locale).then(function (translations) {
          if (translations) {
            _translations = translations;
          }
          _currentLang = locale;
          self.currentLang = locale;
          self._version++;
          document.documentElement.lang = locale;
          return window.electronAPI.setAppLocale(locale);
        });
      },

      init: function () {
        var self = this;

        if (window.electronAPI && window.electronAPI.getAppLocale) {
          return window.electronAPI.getAppLocale().then(function (locale) {
            // Prefer localStorage (set by language.html), then IPC, then default
            var storedLocale;
            try { storedLocale = localStorage.getItem('appLocale'); } catch (e) {}
            var savedLocale = storedLocale || locale || 'en';
            _currentLang = savedLocale;
            self.currentLang = savedLocale;

            // If translations were not loaded synchronously, load async
            if (Object.keys(_translations).length === 0 && window.electronAPI.getTranslations) {
              return Promise.all([
                window.electronAPI.getTranslations(savedLocale),
                window.electronAPI.getTranslations('en')
              ]).then(function (results) {
                if (results[0]) {
                  _translations = results[0];
                }
                if (results[1]) {
                  _fallbackTranslations = results[1];
                }
                self._version++;
                document.documentElement.lang = savedLocale;
              });
            }

            // Translations already loaded via sync — load correct locale if different
            if (savedLocale !== 'en' && window.electronAPI.getTranslationsSync) {
              try {
                var translations = window.electronAPI.getTranslationsSync(savedLocale);
                if (translations) {
                  _translations = translations;
                }
              } catch (e) {
                console.warn('i18n: Could not load saved locale translations:', e);
              }
            }

            self._version++;
            document.documentElement.lang = savedLocale;
          });
        }
      }
    });
  });
})();

// Generated by CoffeeScript 1.9.0
var Instance, User, ext, getTemplateExt, helpers, locale, localization, passport, passwordKeys, randomstring, supportedLocales, timezones;

passport = require('passport');

randomstring = require('randomstring');

locale = require('locale');

User = require('../models/user');

Instance = require('../models/instance');

helpers = require('../lib/helpers');

localization = require('../lib/localization_manager');

passwordKeys = require('../lib/password_keys');

timezones = require('../lib/timezones');

supportedLocales = require('../config').supportedLanguages;

getTemplateExt = require('../helpers/get_template_ext');

ext = getTemplateExt();

module.exports.registerIndex = function(req, res) {
  return User.first(function(err, user) {
    var bestMatch, locales, polyglot, supported;
    if (user == null) {
      supported = new locale.Locales(supportedLocales);
      locales = new locale.Locales(req.headers['accept-language']);
      bestMatch = locales.best(supported).language;
      polyglot = localization.getPolyglotByLocale(bestMatch);
      return res.render("register." + ext, {
        polyglot: polyglot,
        timezones: timezones
      });
    } else {
      return res.redirect('/login');
    }
  });
};

module.exports.register = function(req, res, next) {
  var error, hash, instanceData, userData, validationErrors;
  hash = helpers.cryptPassword(req.body.password);
  userData = {
    email: req.body.email,
    owner: true,
    password: hash.hash,
    salt: hash.salt,
    public_name: req.body.public_name,
    timezone: req.body.timezone,
    activated: true,
    docType: "User"
  };
  instanceData = {
    locale: req.body.locale
  };
  validationErrors = User.validate(userData);
  if (validationErrors.length === 0) {
    return User.all(function(err, users) {
      var error;
      if (err != null) {
        return next(new Error(err));
      } else if (users.length !== 0) {
        error = new Error("User already registered.");
        error.status = 409;
        return next(error);
      } else {
        return Instance.createOrUpdate(instanceData, function(err) {
          if (err) {
            return next(new Error(err));
          } else {
            return User.createNew(userData, function(err) {
              if (err) {
                return next(new Error(err));
              } else {
                localization.polyglot = localization.getPolyglotByLocale(req.body.locale);
                return next();
              }
            });
          }
        });
      }
    });
  } else {
    error = new Error(validationErrors);
    error.status = 400;
    return next(error);
  }
};

module.exports.loginIndex = function(req, res) {
  return User.first(function(err, user) {
    var name, polyglot, words, _ref;
    if (user != null) {
      if (((_ref = user.public_name) != null ? _ref.length : void 0) > 0) {
        name = user.public_name;
      } else {
        name = helpers.hideEmail(user.email);
        words = name.split(' ');
        name = words.map(function(word) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      }
      polyglot = localization.getPolyglot();
      return res.render("login." + ext, {
        polyglot: polyglot,
        name: name
      });
    } else {
      return res.redirect('/register');
    }
  });
};

module.exports.forgotPassword = function(req, res, next) {
  return User.first(function(err, user) {
    var key;
    if (err != null) {
      return next(new Error(err));
    } else if (user == null) {
      err = new Error("No user registered.");
      err.status = 400;
      err.headers = {
        'Location': '/register/'
      };
      return next(err);
    } else {
      key = randomstring.generate();
      Instance.setResetKey(key);
      return Instance.first(function(err, instance) {
        if (err != null) {
          next(new Error(err));
        } else if (instance == null) {
          instance = {
            domain: "domain.not.set"
          };
        }
        return helpers.sendResetEmail(instance, user, key, function(err, result) {
          if (err != null) {
            return next(new Error("Email cannot be sent"));
          } else {
            return res.send(204);
          }
        });
      });
    }
  });
};

module.exports.resetPasswordIndex = function(req, res) {
  var polyglot;
  if (Instance.getResetKey() === req.params.key) {
    polyglot = localization.getPolyglot();
    return res.render("reset." + ext, {
      polyglot: polyglot,
      resetKey: req.params.key
    });
  } else {
    return res.redirect('/');
  }
};

module.exports.resetPassword = function(req, res) {
  var key, newPassword;
  key = req.params.key;
  newPassword = req.body.password;
  return User.first(function(err, user) {
    var data, error, validationErrors;
    if (err != null) {
      return next(new Error(err));
    } else if (user == null) {
      err = new Error("No user registered.");
      err.status = 400;
      err.headers = {
        'Location': '/register/'
      };
      return next(err);
    } else {
      if (Instance.getResetKey() === req.params.key) {
        validationErrors = User.validatePassword(newPassword);
        if (validationErrors.length === 0) {
          data = {
            password: helpers.cryptPassword(newPassword).hash
          };
          return user.merge(data, function(err) {
            if (err != null) {
              return next(new Error(err));
            } else {
              Instance.resetKey = null;
              return passwordKeys.resetKeys(function(err) {
                if (err != null) {
                  return next(new Error(err));
                } else {
                  passport.currentUser = null;
                  return res.send(204);
                }
              });
            }
          });
        } else {
          error = new Error(validationErrors);
          error.status = 400;
          return next(error);
        }
      } else {
        error = new Error("Key is invalid");
        error.status = 400;
        return next(error);
      }
    }
  });
};

module.exports.logout = function(req, res) {
  req.logout();
  return res.send(204);
};

module.exports.authenticated = function(req, res) {
  return res.send(200, {
    isAuthenticated: req.isAuthenticated()
  });
};

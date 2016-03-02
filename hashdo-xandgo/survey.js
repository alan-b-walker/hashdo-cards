module.exports = {
  name: 'Survey',
  description: 'An X&Go Survey Card.',
  icon: 'http://cdn.hashdo.com/icons/survey.png',

  inputs: {
    apiKey: {
      example: 'abcdefghijklmnopqrstuvwxyz',
      description: 'API Key.',
      secure: true,
      required: true
    },
    secret: {
      example: 'abcdefghijklmnopqrstuvwxyz',
      description: 'API Key\'s Secret.',
      secure: true,
      required: true
    },
    userId: {
      example: '552fa62425186c6012edcf18',
      description: 'The current user\'s X&Go ID.',
      required: true,
      secure: true
    },
    surveyId: {
      example: '552fa62425186c6012edcf18',
      description: 'The X&Go ID of the survey to display.',
      required: true
    }
  },

  getCardData: function (inputs, state, callback) {
    var XandGo = require('./lib/xandgo'),
      card = this,
      Moment = require('moment'),
      CUID = require('cuid'),
      _ = require('lodash');

    // enable client side state and proxy support
    card.clientStateSupport = true;
    card.clientProxySupport = true;

    // previously cached?
    if (state.survey) {

      // legacy state support
      state.instances = state.instances || [];

      // render readonly card if already completed
      if (state.complete || (state.survey.limit !== 0 && state.instances.length > state.survey.limit)) {

        // disable client side state & proxy support
        card.clientStateSupport = false;
        card.clientProxySupport = false;

        // enable js support if photos present
        if (state.survey.photos.length > 0) {
          card.client$Support = true;
        }

        callback(null, {
          survey: state.survey,
          percentageComplete: 100,
          complete: true,
          completeDate: formatDate(state.completeDateTimeStamp, state.survey.timezoneOffset)
        });
      }
      else {
        // try for a newer version if no responses
        if (_.keys(state.responses).length === 0) {
          XandGo.getSurvey(inputs.apiKey, inputs.secret, inputs.surveyId, state.version, function (newSurvey, newVersion) {
            if (newSurvey) {
              state.version = newVersion;
              state.survey = newSurvey;

              execCardDataCallback(newSurvey, {}, state.instances, callback);
            }
            else {
              execCardDataCallback(state.survey, {}, state.instances, callback);
            }
          });
        }
        else {
          execCardDataCallback(state.survey, state.responses, state.instances, callback);
        }
      }
    }
    else {
      XandGo.getSurvey(inputs.apiKey, inputs.secret, inputs.surveyId, null, function (survey, version) {
        state.version = version;
        state.survey = survey;
        state.responses = {};
        state.instances = [CUID()];

        execCardDataCallback(survey, state.responses, state.instances, callback);
      });
    }

    function execCardDataCallback(survey, responses, instances, callback) {
      XandGo.getUser(inputs.apiKey, inputs.secret, inputs.userId, function (user) {
        callback && callback(null,

          // jade locals
          {
            survey: survey,
            responseCount: _.keys(responses || {}).length,
            percentageComplete: Math.floor((_.keys(responses || {}).length / survey.questions.length) * 100),
            instances: instances
          },

          // js client side locals
          {
            surveyId: survey.id,
            questions: survey.questions,
            responses: responses || {},
            user: user,
            limit: survey.limit,
            instances: instances,
            previousQuestionId: state.previousQuestionId,
            photoCount: survey.photos.length,
            allowBack: survey.allowBack,
            startLabel: survey.startLabel || 'Start survey'
          }
        );
      });
    }

    function formatDate(value, timezoneOffset, format) {
      format = format || 'D MMM YYYY H:mm';

      if (value) {
        var dt = Moment(value).utc();

        // default offset to GMT +2
        if (_.isUndefined(timezoneOffset) || _.isNull(timezoneOffset) || !_.isNumber(timezoneOffset)) {
          timezoneOffset = 120;
        }

        return dt.utcOffset(timezoneOffset).format(format);
      }
      else {
        return '';
      }
    }
  }
};

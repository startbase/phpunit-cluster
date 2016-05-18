var fs = require('fs');

const settings = require('./config.json');
const local_settings_path = './local.config.json';

var Config = function () {
	/**
	 * @type {Object}
	 */
	this.params = {};

	this.init = function () {
		if (fs.existsSync(local_settings_path)) {
			var local_settings = require('./local.config.json');
			this.params = this.merge(settings, local_settings);
		} else {
			this.params = settings;
		}
	};

	/**
	 * Объединяет настройки в одиное целое с приоритетом из local.config.json
	 *
	 * @param baseSettings Настройки из config.json
	 * @param localSettings Настройки из local.config.json
	 * @returns {Object}
	 */
	this.merge = function(baseSettings, localSettings) {
		for (var key in localSettings) {
			if (localSettings.hasOwnProperty(key)) {
				if (baseSettings[key] && (typeof baseSettings[key] == "object")) {
					baseSettings[key] = this.merge(baseSettings[key], localSettings[key]);
				} else {
					baseSettings[key] = localSettings[key];
				}
			}
		}

		return baseSettings;
	};

	/**
	 * @returns {Object}
	 */
	this.getParams = function () {
		return this.params;
	};

	this.init();
};

module.exports = Config;

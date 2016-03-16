var fs = require('fs');

var localConfigPath = __dirname + '/local.config.json';
var isExistLocalConfig = fs.existsSync(localConfigPath); // Если существует локальный конфиг

var params = require('./config.json');

if (isExistLocalConfig) {
    var localConfig = require(localConfigPath);
    /**
     * Merge recursive two objects
     * @param baseObj
     * @param dominantObj
     * @return Object
     */
    var merge = function (baseObj, dominantObj) {
        for (var key in dominantObj) {
            if (baseObj[key] && (typeof baseObj[key] == "object")) {
                baseObj[key] = merge(baseObj[key], dominantObj[key]);
            } else {
                baseObj[key] = dominantObj[key];
            }
        }
        return baseObj;
    };

    params = merge(params, localConfig);
}

/**
 * @returns {config.json}
 */
exports.getParams = function () {
    return params;
};

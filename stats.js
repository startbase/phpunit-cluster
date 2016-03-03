const EventEmitter = require('events');
const util = require('util');

var Stats = function () {
    this.rows = [];

    this.getStats = function () {
        return "STATS";
    };

    this.addStat = function (data) {

    };

    this.resetStats = function () {

    };

    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();

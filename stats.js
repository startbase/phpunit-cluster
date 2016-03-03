var Stats = function () {


    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();

var Fibonacci = function() {
    this.calc = function(n) {
        if (n < 2) {
            return 1;
        } else {
            return this.calc(n - 2) + this.calc(n - 1);
        }
    }
};

module.exports = new Fibonacci();
var Lib = function () {
    this.fibonacci = function(n) {
        if (n < 2)
            return 1;
        else
            return this.fibonacci(n-2) + this.fibonacci(n-1);
    }
};

module.exports = new Lib();
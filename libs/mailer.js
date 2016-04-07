var nodemailer = require('nodemailer');

var Mailer = function () {
    var self = this;

    this.transporter = null;

    this.smtpConfig = {
        host: 'localhost',
        port: 1025,
        rejectUnhauthorized : false
    };

    this.sendMail = function (mailOptions) {
        // send mail with defined transport object
        self.transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: ' + info.response);
        });
    };

    this.init = function () {
        var self = this;

        // create reusable transporter object using the default SMTP transport
        self.transporter = nodemailer.createTransport(self.smtpConfig);

        // verify connection configuration
        self.transporter.verify(function (error, success) {
            if (error) {
                console.log(error);
            } else {
                console.log('Server is ready to take our messages');
            }
        });
    };

    this.init();

    return {
        sendMail: self.sendMail
    };
};

module.exports = new Mailer();
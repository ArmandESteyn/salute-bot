var builder = require('botbuilder');
require('dotenv').config();
var restify = require('restify');
var request = require('request');

var model = process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

var connector = new builder.ChatConnector();
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
bot.dialog('/', intents);

intents
    .matches('saluteSomeone', [
        confirmMember,
        confirmBadge,
        confirmComment,
        confirmSalute,
        saluteUser
    ])
    .onDefault(
    function (session) {
        session.send('I do not understand');
    }
    )

var memberString;
var badgeString;
var commentString;

var usersArray = [];
var badgeUrl = [];
var itemsArray = [];
var cardArray = [];
var badgeDescription = [];
var badgeName = [];
var filterNames = [];

getUsernames();
getBadgeInfo();

function confirmMember(session, args, next) {
    session.dialogData.entities = args.entities;
    var getMember = builder.EntityRecognizer.findEntity(args.entities, 'member');
    if (getMember) {

        next(args, { response: getMember.entity });
    }
    else {

        builder.Prompts.choice(session, 'Who do you want to salute?', usersArray);


    }

    confirmUser(session, args, next)
    {

    }


}

function confirmBadge(session, args, next) {

    var getBadge = builder.EntityRecognizer.findEntity(args.entities, 'badge');
    var getMember = builder.EntityRecognizer.findEntity(args.entities, 'member');



    if (args.response) {
        memberString = args.response.entity;

    }
    else {
        memberString = getMember.entity;

    }
    // Search for the user here 

    if (getBadge) {
        next(args, { response: getBadge.entity });
    }
    else {


        var cards = getCardsAttachments(session);
        var reply = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);

        session.send('Please give ' + memberString + ' a Badge');
        builder.Prompts.choice(session, reply, badgeName);




    }



}

function confirmComment(session, args, next) {
    var getBadge = builder.EntityRecognizer.findEntity(args.entities, 'badge');
    var getComment = builder.EntityRecognizer.findEntity(args.entities, 'comment');

    if (args.response) {
        badgeString = args.response.entity;

    }
    else {
        badgeString = getBadge.entity;

    }
    if (getComment) {
        next(args, { response: getBadge.entity });
    }
    else {
        builder.Prompts.text(session, 'Ok you have ' + memberString + ' Saluted with a badge of a ' + badgeString + ' now lets add a comment ');
    }


}

function confirmSalute(session, args, next) {
    var getComment = builder.EntityRecognizer.findEntity(args.entities, 'comment');

    if (args.response) {
        commentString = args.response;

    }
    else {
        commentString = getComment.entity;

    }

    builder.Prompts.confirm(session, "I will Salute " + memberString + ' with a badge of a ' + badgeString + ' and add the comment ' + commentString + ' ,is this ok?');
}

function saluteUser(session, args) {
    if (args.response == true) {
        session.send('Let me do that for you');
    }
    else {
        session.send('Very well I will cancel your request');
    }
}




function getUsernames(session) {
    var options = {
        url: 'https://saluteapi.fivefriday.com//api/recognition/users',
        headers: {
            Authorization: process.env.API_KEY,
            Company: 'fivefriday'
        }
    };

    function callback(error, response, body) {

        if (!error && response.statusCode == 200) {

            var info = JSON.parse(body);


            for (i = 0; i < info.length; i++) {
                usersArray.push(info[i].firstName + " " + info[i].lastName);
            }

            //session.send(usersArray[1]);

        }

    }

    request(options, callback);
}



function getBadgeInfo(session) {
    var options = {
        url: 'https://saluteapi.fivefriday.com/api/Badge?active=true&currentPage=1&perPage=9999',
        headers: {
            Authorization: process.env.API_KEY,
            Company: 'fivefriday'
        }
    };

    function callback(error, response, body) {

        if (!error && response.statusCode == 200) {

            var info = JSON.parse(body);

            itemsArray = info.items;

            for (j = 0; j < itemsArray.length; j++) {
                badgeUrl.push(itemsArray[j].badgeImageUrl);
                badgeName.push(itemsArray[j].name);
                badgeDescription.push(itemsArray[j].description);
            }
        }
    }

    request(options, callback);


}

function getCardsAttachments(session) {

    for (i = 0; i < badgeUrl.length; i++) {
        cardArray.push
            (
            new builder.ThumbnailCard(session)
                .images([
                    builder.CardImage.create(session, badgeUrl[i])
                ])
                .title(badgeName[i])
                .text(badgeDescription[i])
                .buttons([
                    builder.CardAction.imBack(session, badgeName[i], "Select")
                ])
            )

    }

    return cardArray;

}





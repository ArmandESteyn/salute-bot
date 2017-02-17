var builder = require('botbuilder');
require('dotenv').config();
var restify = require('restify');
var request = require('request');

//Using a LUIS model
var model = process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });

//Setup Restify server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

server.get('/test/:name', function (req, res) {
    res.send('hello ' + req.params.name);
    return next();
});


//Setup Bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
bot.dialog('/', intents);

//The Intents handled by the bot
intents
    .matches('saluteSomeone', [
        confirmMember,
        searchForSomeone,
        confirmBadge,
        confirmReason,     //Waterfall functions each following up on eachother
        confirmSalute,
        saluteUser
    ])
    .matches('searchForSomeone', 
        function(session)
        {
        
        }
    )
    .matches('topSalutes', [
        getTop
    ])
    .matches('Help',[
        helpTheUser
    ])
    .onDefault(     //Default intent when the bot does not know what you want.
    function (session) {
        session.send('I do not understand');
    }
    )

var memberString; //Contains the member string
var badgeString; //Contains the badge string
var reasonString;  // contains the comment string
var usersArray = []; //an object containing all the names and lastnames of salute users
var badgeUrl = []; //an object containing all the badge image urls
var cardArray = []; // an object of badge attatchment cards 
var badgeDescription = []; //description of the badges
var badgeName = []; //badge names
var userId = []; //Array of user ID's


getUsernames(); // Does a API request to fetch all the user names and surnames
getBadgeInfo(); // Gets all the badge info and populates the array objects



//#########################################################################################################################
                                                //Salute Someone waterfall methods
//#########################################################################################################################
function confirmMember(session, args, next) {   // See if the user provided a user after the salute command

    var getMember = builder.EntityRecognizer.findEntity(args.entities, 'member'); // get the name if provided
    var nameExists = false;
    if (getMember) { // if a name is provided carry on to the next function

        for (i = 0; i < usersArray.length; i++) {
            if (getMember.entity == usersArray[i].toLowerCase()) {
                nameExists = true;
            }
        }

        if (true)//nameExists == true)
        {
            next(args, { response: getMember.entity });
        }
        else {
            session.send(usersArray[44].toLowerCase());
            session.send(getMember.entity);
            session.send("Sorry this person does not exist");
        }

    }
    else {

        builder.Prompts.text(session, 'Who do you want to salute?'); // Ask the user for a user to salute and pass it to the next function

    }
}

function searchForSomeone(session, args, next) {

    var getMember = builder.EntityRecognizer.findEntity(args.entities, 'member');
    var nameFilter = [];
    var nameToLower = [];

    if (args.response) {

        memberString = args.response;

    }
    else {
        memberString = getMember.entity;

    }

    if (getMember) {
        next(args, { response: getMember.entity });
    }
    else {
        for (j = 0; j < usersArray.length; j++) {
            nameToLower.push(usersArray[j].toLowerCase());
            if (nameToLower[j].includes(memberString.toLowerCase())) {
                nameFilter.push(usersArray[j]);
            }
        }

        if (nameFilter.length > 0) {
            builder.Prompts.choice(session, 'I have found some people', nameFilter);
        }
        else {
            session.send("Sorry I could not find anyone 0_0");
        }



    }

}

function confirmBadge(session, args, next) {

    var getBadge = builder.EntityRecognizer.findEntity(args.entities, 'badge');
    var getMember = builder.EntityRecognizer.findEntity(args.entities, 'member');



    if (args.response) {
        memberString = args.response.entity

    }
    else {
        memberString = getMember.entity;

    }



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

function confirmReason(session, args, next) {
    var getBadge = builder.EntityRecognizer.findEntity(args.entities, 'badge');
    var getReason = builder.EntityRecognizer.findEntity(args.entities, 'reason');

    if (args.response) {
        badgeString = args.response.entity

    }
    else {
        badgeString = getBadge.entity;

    }
    if (getReason) {
        next(args, { response: getBadge.entity });
    }
    else {
        builder.Prompts.text(session, 'Ok you have ' + memberString + ' Saluted with a badge of a ' + badgeString + ' now lets add a Reason ');
    }


}

function confirmSalute(session, args, next) {
    var getReason = builder.EntityRecognizer.findEntity(args.entities, 'reason');

    if (args.response) {
        ReasonString = args.response;

    }
    else {
        ReasonString = getReason.entity;

    }

    builder.Prompts.confirm(session, "I will Salute " + memberString + ' with a badge of a ' + badgeString + ' and add a Reason ' + ReasonString + ' ,is this ok?');
}

function saluteUser(session, args) {
    if (args.response == true) {
        session.send('Let me do that for you');
    }
    else {
        session.send('Very well I will cancel your request');
    }
}
//##########################################################################################################################



//###########################################################################################################################
                                                    //HTTP requests
//###########################################################################################################################
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
                userId.push(info[i].userId);
            }

        }

    }

    request(options, callback);
}

function getBadgeInfo(session) {
    var itemsArray = [];
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

function getSingleUser(){

     var options = {
        url: 'https://saluteapi.fivefriday.com/api/profile/',
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

        }

    }

    request(options, callback);
}

function getTop(session) {
    var TopArray = [];
    var itemsArray = [];
    var options = {
        url: 'https://saluteapi.fivefriday.com/api/leaderboard?perPage=5&currentPage=1&sort=position',
        headers: {
            Authorization: process.env.API_KEY,
            Company: 'fivefriday'
        }
    };


    function callback(error, response, body) {


        if (!error && response.statusCode == 200) {

            var info = JSON.parse(body);

            itemsArray = info.items;
            var topstring = "";

            for (i = 0; i < itemsArray.length; i++) {
                TopArray.push(itemsArray[i].firstName + " " + itemsArray[i].lastName);
                topstring += TopArray[i] + "\n\n";
            }

            session.send(topstring);

        }

    }

    request(options, callback);

}
//###########################################################################################################################


//###########################################################################################################################
                                                    //Other Functions
//###########################################################################################################################
function helpTheUser(session){
    session.send("This is what i do when you type help");
}

function searchForSome1(session, args, next) {
    var getMember = builder.EntityRecognizer.findEntity(args.entities, 'member');
    var nameFilter = [];
    var nameToLower = [];

    if (getMember) {
        for (j = 0; j < usersArray.length; j++) {
            nameToLower.push(usersArray[j].toLowerCase());
            if (nameToLower[j].includes(getMember.entity)) {
                nameFilter.push(usersArray[j]);
            }
        }
        if (nameFilter.length > 0) {
            session.send(getMember.entity);
            builder.Prompts.choice(session, 'I have found some people', nameFilter);
        }

    }

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

//############################################################################################################################
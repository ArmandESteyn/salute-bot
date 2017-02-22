var builder = require('botbuilder');
require('dotenv').config();
var restify = require('restify');
var request = require('request');
var Promise = require("bluebird");
var Issuer = require('openid-client').Issuer;


//Using a LUIS model
var model = process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });

//Setup Restify server
var server = restify.createServer();

server.use(restify.queryParser());
server.use(restify.bodyParser());

server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});



//Setup Bot
var connector = new builder.ChatConnector({
    appId:process.env.MICROSOFT_APP_ID,
    appPassword:process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//---------------------------------------------------------------------------------------------------
//                                       Global Variables
//---------------------------------------------------------------------------------------------------
var memberString; //Contains the member string
var badgeString; //Contains the badge string
var reasonString;  // contains the comment string
var usersArray = []; //an object containing all the names and lastnames of salute users
var badgeUrl = []; //an object containing all the badge image urls
var cardArray = []; // an object of badge attatchment cards 
var badgeDescription = []; //description of the badges
var badgeName = []; //badge names
var userId = []; //Array of user ID's
var Token = "";
var tokenUrl;
var topstring = "";
//---------------------------------------------------------------------------------------------------

//---------------------------------------------------------------------------------------------------
//                                        Authentication
//---------------------------------------------------------------------------------------------------
var getClient = function () {
    return new Promise((resolve, reject) => {
        Issuer.discover('https://account-dev.fivefriday.com') // => Promise
            .then(function (ff) {
                console.log('Discovered issuer %s', JSON.stringify(ff));
                client = new ff.Client({
                    client_id: 'SaluteNode',
                    client_secret: 'secret'
                }); // => Client
                resolve(client);
            });
    });
}


server.get('/callback/:id/:details', function (req, res, next) {
    console.log("params", JSON.stringify(req.params));
    console.log("my id is", req.params.id);

    getClient().then(function (client) {
        
        client.authorizationCallback('https://salute-bot.azurewebsites.net/callback/' + req.params.id + '/' + req.params.details, req.params)
            .then(function (tokenSet) {
                console.log('received and validated tokens %j', tokenSet);
                Token = tokenSet.access_token;

                console.log('validated id_token claims %j', tokenSet.access_token); //!!!!!!!!!!!!!!!!!!!!!
                res.send('Thanks for Loggin In go back to the chat ');
                return next();

            }, function (err) {
                res.send('Sorry cant log in');
                return next();
            });


    }, function (err) {
        res.send('Sorry cant log in broke first call');
        return next();
    });
});
//---------------------------------------------------------------------------------------------------

bot.dialog('/', [
    function (session) {
        //Authenticate user
        session.beginDialog('/ensureProfile', session.userData.profile);

    },
    function (session, results, next) {
        session.userData.profile = results.response;

        getUsernames(session);
        getBadgeInfo(session);
        getTop(session);

        session.send("You are all set. Lets begin. Type Help to see what I can do");
        session.send(usersArray.length);
        session.beginDialog('/intents');

    }

]);

//---------------------------------------------------------------------------------------------------
//                                         Dialog Intents
//---------------------------------------------------------------------------------------------------
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
    .matches('Greeting', [
        function (session) {
            session.send("Hi! I am Salute Bot nice to meet you :D");
        }
    ])
    .matches('topSalutes', [
        function(session)
        {
            session.send(topstring);
        }
    ])
    .matches('Help', [
        helpTheUser
    ])
    .onDefault(     //Default intent when the bot does not know what you want.
    function (session) {
        session.send('I do not understand');
    }
    )

//---------------------------------------------------------------------------------------------------

//---------------------------------------------------------------------------------------------------
//                                          Bot Dialogs
//---------------------------------------------------------------------------------------------------
bot.dialog('/ensureProfile', [
    function (session, args, next) {
        session.dialogData.profile = args || {};
        if (!session.dialogData.profile.Key) {

            getClient().then((client) => {
                var loginUrl = client.authorizationUrl({
                    redirect_uri: 'https://salute-bot.azurewebsites.net/callback/uselater/',
                    scope: 'openid profile Salute',
                });
                tokenUrl = loginUrl;
                var cards = getLoginCard(session)
                var reply = new builder.Message(session)
                .attachments(cards);

                session.send("Hello I am Salute-Bot. Nice to meet you :D. Before we get started I will need some information.")
                session.send(reply);
                builder.Prompts.confirm(session, "Did you log in?");

            });

        } else {
            next();
        }
    },
    function (session, results, next) {
        var companyNames = ["fivefriday"];
        if (results.response) {
            session.dialogData.profile.Key = Token;
        }
        if (!session.dialogData.profile.companyName) {
            builder.Prompts.choice(session, " Can you please provide me with your Company Name?", companyNames);
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.profile.companyName = results.response.entity;
        }

        session.endDialogWithResult({ response: session.dialogData.profile });
    }
])

bot.dialog('/intents', intents);
//---------------------------------------------------------------------------------------------------



//---------------------------------------------------------------------------------------------------
//                                  Salute Someone waterfall methods
//---------------------------------------------------------------------------------------------------
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
//---------------------------------------------------------------------------------------------------



//---------------------------------------------------------------------------------------------------
//HTTP requests
//---------------------------------------------------------------------------------------------------
function getUsernames(session) {
    var options = {
        url: 'https://saluteapi-dev.fivefriday.com//api/recognition/users',
        headers: {
            Authorization: "Bearer "+session.userData.profile.Key,
            Company: session.userData.profile.companyName
        }
    };

    function callback(error, response, body) {

        if (!error && response.statusCode == 200) {

            var info = JSON.parse(body);


            for (i = 0; i < info.length; i++) {
                usersArray[i] = (info[i].firstName + " " + info[i].lastName);
                userId[i] = info[i].userId;
            }


        }
    };

    request(options, callback);
}

function getBadgeInfo(session) {
    var itemsArray = [];
    var options = {
        url: 'https://saluteapi-dev.fivefriday.com/api/Badge?active=true&currentPage=1&perPage=9999',
        headers: {
            Authorization: "Bearer "+session.userData.profile.Key,
            Company: session.userData.profile.companyName
        }
    };

    function callback(error, response, body) {

        if (!error && response.statusCode == 200) {

            var info = JSON.parse(body);

            itemsArray = info.items;

            for (j = 0; j < itemsArray.length; j++) {
                badgeUrl[j] = itemsArray[j].badgeImageUrl;
                badgeName[j] = itemsArray[j].name;
                badgeDescription[j] = itemsArray[j].description;
            }
        }
    }

    request(options, callback);


}

function getTop(session) {
    var TopArray = [];
    var itemsArray = [];
    var options = {
        url: 'https://saluteapi-dev.fivefriday.com/api/leaderboard?perPage=5&currentPage=1&sort=position',
        headers: {
            Authorization: "Bearer "+session.userData.profile.Key,
            Company: session.userData.profile.companyName
        }
    };


    function callback(error, response, body) {


        if (!error && response.statusCode == 200) {

            var info = JSON.parse(body);

            itemsArray = info.items;
            

            for (i = 0; i < itemsArray.length; i++) {
                TopArray[i] = (itemsArray[i].firstName + " " + itemsArray[i].lastName);
                topstring += TopArray[i] + "\n\n";
            }

        }

    }

    request(options, callback);

}
//---------------------------------------------------------------------------------------------------


//---------------------------------------------------------------------------------------------------
//Other Functions
//---------------------------------------------------------------------------------------------------
function helpTheUser(session) {
    session.send("I can help by answering simple questions about how I work. I'm just a bot, though! If you need more help, ask someone else. Here is a list of my commands \n\n Salute \n\n Top \n\n Help");
}

function getCardsAttachments(session) {

    for (i = 0; i < badgeUrl.length; i++) {
        cardArray[i] =
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

function getLoginCard(session){
    return [
        new builder.ThumbnailCard(session)
                            .title("Please Log In")
                            .buttons([
                                builder.CardAction.openUrl(session,tokenUrl, "Log in")
                            ])
    ]
}


//---------------------------------------------------------------------------------------------------
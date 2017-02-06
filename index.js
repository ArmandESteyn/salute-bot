var builder = require('botbuilder');
require('dotenv').config();

var model = process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });

var connector = new builder.ConsoleConnector().listen();
var bot = new builder.UniversalBot(connector);
bot.dialog('/',intents);

intents
.matches('saluteSomeone',[
    confirmMember,confirmBadge,confirmComment,SaluteUser
]);

    var memberString;
    var badgeString;
    var commentString;

    function confirmMember(session,args,next)
    {
       session.dialogData.entities = args.entities; 
       var getMember = builder.EntityRecognizer.findEntity(args.entities,'member');
       if(getMember)
       {
           next(args,{response: getMember.entity});
       }
       else
       {
         builder.Prompts.text(session,'Please provide me with a user to salute')
       } 

      
       
    }

    function confirmBadge(session,args,next)
    {
       
       var getBadge = builder.EntityRecognizer.findEntity(args.entities,'badge');
       var getMember = builder.EntityRecognizer.findEntity(args.entities,'member');
     
        
      
        if(args.response)
        {
            memberString = args.response;
           
        }
        else
        {
            memberString = getMember.entity;
           
        }

        if(getBadge)
        {
            next(args,{response: getBadge.entity});
        }
        else
        {
            builder.Prompts.text(session,'Please give '+memberString+' a Badge');
        }
           
        
      
    }

    function confirmComment(session,args,next)
    {
         var getBadge = builder.EntityRecognizer.findEntity(args.entities,'badge');
         var getComment = builder.EntityRecognizer.findEntity(args.entities,'comment');

         if(args.response)
        {
            badgeString = args.response;
           
        }
        else
        {
            badgeString = getBadge.entity;
           
        }
        if(getComment)
        {
            next(args,{response: getBadge.entity});
        }
        else
        {
            builder.Prompts.text(session,'Ok you have '+memberString+' Saluted with a badge of '+badgeString+' now lets add a comment ');
        }


    }

    function SaluteUser(session,args)
    {
        var getComment = builder.EntityRecognizer.findEntity(args.entities,'comment');
         
        if(args.response)
        {
            commentString = args.response;
           
        }
        else
        {
            commentString = getComment.entity;
           
        }

        session.send("I will Salute "+memberString+' with a badge of a '+badgeString+' and add the comment '+commentString+' is this ok?');
    }


  


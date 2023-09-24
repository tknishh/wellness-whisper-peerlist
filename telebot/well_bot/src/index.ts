import * as dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from "telegraf";
import { Model as ChatModel } from "./models/chat";
import fs from 'fs';
// import { textToSpeech, deleteAudioFilesAfterSent } from "./lib/htApi"; // Import the textToSpeech function

const telegramToken = process.env.TELEGRAM_TOKEN as string;
if (!telegramToken) {
  throw new Error('TELEGRAM_TOKEN is not defined in the environment');
}
const bot = new Telegraf(telegramToken);  

let model = new ChatModel();
const startTime = Date.now();

// Define User interface
interface User {
  telegramId: string;
  name: string;
  chatHistory: {
    input: string;
    output: string;
    timestamp: Date;
  }[];
  preferences: any;
}

// Load users from JSON file
const loadUsers = (): User[] => {
  try {
    const data = fs.readFileSync('users.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading users from JSON file: ${error}`);
    return [];
  }
}

// Save users to JSON file
const saveUsers = (users: User[]) => {
  try {
    const data = JSON.stringify(users, null, 2);
    fs.writeFileSync('./users.json', data);
  } catch (error) {
    console.error(`Error saving users to JSON file: ${error}`);
  }
}

const logConversation = (userId: string, name: string, input: any, output: any) => {
  const timestamp = new Date();
  const logEntry = { input, output, timestamp };
  
  // Load users from JSON file
  const users = loadUsers();
  
  // Find user by Telegram ID
  let user = users.find(user => user.telegramId === userId);
  
  // If user doesn't exist, create a new user
  if (!user) {
    user = { telegramId: userId, name, chatHistory: [], preferences: {} };
    users.push(user);
  }
  
  // Add log entry to user's chat history
  user.chatHistory.push(logEntry);
  
  // Save users to JSON file
  saveUsers(users);
}

bot.start(async (ctx) => {
  try {
    const username = ctx.from.username;
    ctx.reply(`Hi, I'm Susan, I'm an expert therapist. Welcome to my Telegram bot, How can I help?`);
    // Removed code that loads previous conversation
  } catch (error) {
    console.error(`Error sending start message: ${error}`);
  }
});

bot.help((ctx) => {
  try {
    ctx.reply("Send me a message and I will echo it back to you.");
  } catch (error) {
    console.error(`Error sending help message: ${error}`);
  }
});

bot.on("message", async (ctx) => {
  // Check if message was sent after script was started

  console.log("###startTime: ", startTime);
  if (ctx.message.date * 1000 < startTime) {
    return;
  }
  
  const text = (ctx.message as any).text;
  
  
  if (!text) {
    ctx.reply("Please send a text message.");
    return;
  }

  

  console.log("Input: ", text);

  await ctx.sendChatAction("typing");
  
  try {
    let response;
    let textTemp = text.toLowerCase();
    // let flag = true;
    if (textTemp == "hi" || textTemp == "hey" || textTemp == "hello" ){
      response = "Hi, I'm Nyx, feel free to talk to me. How can i be of assistance today?";
      // flag = false;
    } else {
      response = await model.call(text);
    }
    console.log("Generated Response: ", response); // Debugging console log
    
    if (!response) {
      response = "Sorry, I couldn't generate a response.";
    }
    
    // Log conversation to JSON file
    const name = ctx.from.first_name;
    logConversation(ctx.from.id.toString(), name, text, response);
    
    // Send the generated response as a text reply
    await ctx.reply(response);
    
    // Generate speech from the response and send it as voice reply
  //   try {
  //     const responseAudioPath = await textToSpeech(response);
  //     await ctx.sendChatAction("typing");
  //     await ctx.replyWithVoice({
  //       source: fs.createReadStream(responseAudioPath),
  //       filename: "response.mp3",
  //     });
  //     await deleteAudioFilesAfterSent(responseAudioPath);
  //   } catch (error) {
  //     console.log(error);
  //     await ctx.reply(
  //       "Whoops! There was an error while synthesizing the response as speech."
  //     );
  //   }
  } catch (error) {
    // ... (existing error handling)
  }
});

// Run model.init only once - not everytime a message is received. 
// TODO - Refactor it wherever you can. 
async function botStartupFunc (){
  try {
    await model.init();
  } catch (error) {
    console.error(`Error initializing model: ${error}`);
    return;
  }
};

botStartupFunc();
// TODO Add the webhook details inside launch function while hosting
bot.launch();

process.on("SIGTERM", () => {
  bot.stop();
});

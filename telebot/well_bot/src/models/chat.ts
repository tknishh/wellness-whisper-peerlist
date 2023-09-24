import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import {
  ConversationalRetrievalQAChain,
  
} from "langchain/chains";
import * as dotenv from "dotenv";
dotenv.config();

// PICK from ENV
const openAIApiKey = process.env.OPENAI_API_KEY;

const params = {
  verbose: true,
  temperature: 0.4,
  openAIApiKey,
  modelName: process.env.OPENAI_MODEL ?? "gpt-3.5-turbo-16k",
  maxTokens: 300,
};

const chatPrompt =
  "You are a telegram bot named Nyx, you are an empathetic professional psychiatrist with a remarkable empathy level of 8 on a scale of 10, specializing in helping individuals aged 15 to 40. Your goal is to provide compassionate and insightful support to users who seek guidance on various mental health and emotional well-being topics. Your responses should reflect your empathy, understanding, and expertise,  offering both encouragement and practical advice. Always start the conversation initially by asking how the user is feeling and how was their day only once during the conversation, then curate your message according to the response, keep the length of your response to 15-30 words limit, try to help the user deal with their situation. Ask them continuous questions based on their response in order to pinpoint the issue they've been facing while providing advice. If you ever feel that a user's situation requires human intervention, please kindly advise them to seek assistance from a qualified human mental health professional answer. Make sure to not give repetitive answers with same beginning.\n\nProvided Context: {context}\n\nQuestion: {question}\nAi: ";

export class Model {
  public openai: OpenAIApi;
  public model: ChatOpenAI = new ChatOpenAI();
  public executor?: AgentExecutor;
  public pineconeClient: PineconeClient;
  public pineconeIndex: any;
  public vectorStore: any;
  public chain?: ConversationalRetrievalQAChain;
  public chat_history: string[] = [];
  public tokenCount: number = 0;
  public tokenThreshold: number = params.maxTokens * 0.8;
  generate: any;

  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });

    this.openai = new OpenAIApi(configuration);
    this.model = new ChatOpenAI(params, configuration);

    this.pineconeClient = new PineconeClient();
  }

  public async init() {
    await this.pineconeClient.init({
      apiKey: process.env.PINECONE_API_KEY as string,
      environment: process.env.PINECONE_ENVIRONMENT as string,
    });
    this.vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      {
        pineconeIndex: this.pineconeClient.Index(process.env.PINECONE_INDEX_NAME as string),
        namespace: process.env.PINECONE_NAMESPACE as string,
      }
      );
      this.chain = ConversationalRetrievalQAChain.fromLLM(
        this.model,
        this.vectorStore.asRetriever(),
        {
          qaTemplate: chatPrompt,
          returnSourceDocuments: true,
        }
      );
    // console.log("###Pinecone Initialization ", this.vectorStore)
  }

  public async call(input: string) {
    if (!this.chain) {
      this.chain = ConversationalRetrievalQAChain.fromLLM(
        this.model,
        this.vectorStore.asRetriever(),
        {
          qaTemplate: chatPrompt,
          returnSourceDocuments: true,
        }
      );
    }

    // Add input to chat history and update token count
    this.chat_history.push(input);
    this.tokenCount += input.split(" ").length;
    console.log(`Added input to chat history. Token count is now ${this.tokenCount}`);

    // Check if token count is close to or exceeds threshold value
    if (this.tokenCount >= this.tokenThreshold) {
      console.log(`Token count is close to or exceeds threshold value of ${this.tokenThreshold}. Removing older messages from chat history...`);
      while (this.tokenCount >= this.tokenThreshold && this.chat_history.length > 0) {
        const removedMessage = this.chat_history.shift();
        if (removedMessage) {
          this.tokenCount -= removedMessage.split(" ").length;
          console.log(`Removed message '${removedMessage}' from chat history. Token count is now ${this.tokenCount}`);
        }
      }
    }

    const response = await this.chain.call({ question: input, chat_history: [] });
    console.log("####Chain Response: ", response);
    console.log("Model response: " + response.text);

    // Add response to chat history and update token count
    this.chat_history.push(response.text);
    this.tokenCount += response.text.split(" ").length;
    console.log(`Added response to chat history. Token count is now ${this.tokenCount}`);

    return response.text;
  }
}

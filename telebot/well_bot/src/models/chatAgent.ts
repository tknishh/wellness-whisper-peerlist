import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Tool, VectorStoreQATool } from "langchain/dist/tools";
import { googleTool } from "./tools/google";
import { VectorDBQAChain } from "langchain/chains";
import { SerpAPI, ChainTool } from "langchain/tools";


// PICK from ENV
const openAIApiKey = "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";

const params = {
  verbose: true,
  temperature: 0.1,
  openAIApiKey,
  modelName: process.env.OPENAI_MODEL ?? "gpt-3.5-turbo",
  // maxTokens: 100,
  // maxRetries: 5,
  // max_execution_time:1,
};

export class Model {
  public tools: any;
  public openai: OpenAIApi;
  public model: ChatOpenAI = new ChatOpenAI();
  public executor?: AgentExecutor;
  public pineconeClient: PineconeClient;
  public pineconeIndex: any;
  public vectorStore: any;

  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });
    
    
    this.openai = new OpenAIApi(configuration);
    this.model = new ChatOpenAI(params, configuration);
    
    // Initialize Pinecone Client
    this.pineconeClient = new PineconeClient();
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      // PICK from ENV
      SystemMessagePromptTemplate.fromTemplate(
        "You are an expert psychiatrist specializing in treating individuals with tinnitus. The user seeking help has tinnitus and has come to you for assistance. Delve into the available resources to formulate your responses. When the user poses questions, provide brief and succinct answers, guiding them as if you were engaged in a one-on-one private conversation."
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);
    this.tools = [];
  }

  public async init() {
    console.log("Initializing Pinecone client...");
    // PICK FROM ENV
    await this.pineconeClient.init({
      apiKey: "674cfe91-56ed-4676-85ac-b62626b73d9b",
      environment: "northamerica-northeast1-gcp",
    });
    console.log("Pinecone client initialized");
        // ## WORK On this
    this.vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: this.pineconeClient.Index("tinnitus") }
    );
    const chain = await VectorDBQAChain.fromLLM(this.model, this.vectorStore);
    const VectorStoreQATool = new ChainTool({
      name: "Tinnitus Consultancy",
      description:
      "Tinnitus Consultancy - useful for all questions related to Tinnitus. All user questions are related to Tinnitus",
      chain: chain,
      // ## Experiment with this 
      // returnDirect: true
    });
    this.tools.push(VectorStoreQATool);
    console.log("###Vector Store: ", await this.vectorStore);
    console.log("##Tools: ", this.tools);
    console.log("Initializing vector store...");
    console.log("###Vector Store: ", this.vectorStore);
    console.log("Vector store initialized");
  }

  public async call(input: string) {
    // Perform similarity search
    const results = await this.vectorStore.similaritySearch(input);
    console.log("Search results:", results);

    // Initialize executor if it doesn't exist
    if (!this.executor) {
      // ##handle Prefix later
      this.executor = await initializeAgentExecutorWithOptions(
        this.tools,
        this.model,
        {
          // agentType: "chat-conversational-react-description",
          // agentType: "chat-zero-shot-react-description",
          agentType: "zero-shot-react-description",
          // agentType: "react-docstore",
          verbose: true,
          agentArgs: { systemMessageTemplate: "You are an expert psychiatrist, and the user seeks your guidance regarding their tinnitus condition. Your task is to provide concise and helpful responses to the user's questions, offering guidance as if you were engaged in a private one-on-one conversation." }
        },
      );
      this.executor.memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
        inputKey: "input",
      });
    }

    // Pass the input and search results to the executor
    // ## Can we use agent. run here? 
    const response = await this.executor!.call({ input, results });

    console.log("Model response: " + response);

    return response.output;
  }
}

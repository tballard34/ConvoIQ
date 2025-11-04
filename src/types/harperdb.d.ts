// Type declarations for HarperDB global objects

declare global {
  const tables: {
    Conversation: any;
  };
  
  class Resource {
    static loadAsInstance?: boolean;
    get?(request?: any): any;
    post?(content: any): any;
    put?(content: any): any;
    delete?(request?: any): any;
  }
}

export {};


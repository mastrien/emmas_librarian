declare module 'citation-js' {
  class Cite {
    constructor(data?: any, options?: any);
    add(data: any): this;
    format(style: string, options?: any): string;
    static async(data: any, options?: any): Promise<Cite>;
    static plugins: any;
  }
  export = Cite;
}

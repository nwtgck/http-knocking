declare module "json-templates" {
  function JsonTemplates(value: any): JsonTemplates.Template;

  // (from: https://qiita.com/sakymark/items/601b9ba4c5ff9a2d51e8)
  namespace  JsonTemplates {
    interface Parameter {
      key: string,
      defaultValue?: any
    }
    interface Template{
      parameters: Parameter[];
      (v?: {[key:string]: any}): any
    }
  }
  export = JsonTemplates
}

import { Import, Tag } from "./Tag";

export class Templates extends Tag {
  static Templates = new Map<string, Tag>()
  templates: any[]

  constructor(attrs: any[]) {
    super(undefined)
    this.templates = attrs
  }

  async setup() {
    await Import(this.templates, this.tc)
  }

  exec() { }
}

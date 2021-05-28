import { Import, Tag } from "./Tag";

export class Templates extends Tag {
  static Templates = new Map<string, Tag>()
  templates: any[]

  init(attrs: any) {
    this.templates = attrs
    super.init(undefined)
  }

  async setup() {
    await Import(this.templates, this.tc)
  }

  exec() { }
}

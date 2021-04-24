# grpc_doc.yaml
_/Users/doanthuanthanh/code/github/testapi6/test/examples/grpc_doc.yaml_


> Version ``
> Last updated: `Sat Apr 24 2021 11:11:52 GMT+0700 (Indochina Time)`

## APIs

|No.  | API Description | API Function |
|---: | ---- | ---- |
|  | __default__ - _1 items_ |  |
|1.| [**Test call to a gRPC server**](#1) | `/user/RouteUser.GetUsers(?)` |
## Servers
## Details
### **Test call to a gRPC server**

`/user/RouteUser.GetUsers(?)`

#### Metadata
- `api-key`: *my-key-here*
#### Output
```json
{
  "data": [
    {
      "name": "thanh",
      "age": 1
    }
  ],
  "code": 1
}
```
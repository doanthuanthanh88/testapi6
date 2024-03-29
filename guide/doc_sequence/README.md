# Doc sequence
_Auto generate diagrams from any file which base on comment line_

# Features
1. Generate sequence diagram for each features base on comment line in code
2. Auto generate a flow diagram which describe how to our service run
3. Generate class diagram for data model base on comment line in code

# Installation
- Use with `vscode extension`
  - Install `doanthuanthanh88.testapi6`
- Use by command line
```sh
  npm install -g testapi6
```

# How to run

1. Prepare configuration file `gen_seq_doc.yaml`
```yaml
- DocSequence:
    title: My first service                 # This is service name (requried)
    ext:                                    # Only scan files which file name endwiths these values
      - .ts             
    excludes:                               # Ignore scan these folders
      - node_modules              
    theme: default                          # Default color in diagrams ("default", "forest", "dark", "neutral")
    slient: true                            # Disable log
    src: ../../src                          # Source path which includes code files
    # src: 
    # - /path1
    # - /path2
    saveTo: ./mmd                               # Target path which includes the output document
    # outputType: svg                           # Generate .MD content which includes .svg file or mermaid syntax. Default is 'mmd'. Support 'svg' | 'mmd'
    # puppeteerPath: $HOME/.config/yarn/global  # Path of folder to puppeteer module. Used when outputType is 'svg'. Default it auto detect in global npm or yarn
        # runOnNodeJS:  true                    # Set to true when could not run bin path. Only run via node command
        # combineOverviews:                     # Combine multiple overviews to one
        #   - .../service1/wiki/resources/mmd/overview.mmd
        #   - .../service2/wiki/resources/mmd/overview.mmd
    # stack: true                               # Auto generate number in sequence diagram
    # autoNumber: true                          # Activations can be stacked for same actor
    # space: 4                                  # Set number of spaces in each steps in code. Default "null" is auto detect
    # backgroundColor: "#FFFFFF"                # Chart background color (Not support .svg)
    # width: 800                                # Chart width
    # height: 600                               # Chart height
    # config:                                   # Config for mermaid
    # cssFile: ./mermaid.css                    # CSS file for the page
    # puppeteerConfig:                          # Configuration for puppeteer
    # showEventDetails: false                   # Show all of events in overview diagram
    # showRequestDetails: false                 # Show all of requests in overview diagram
    # fileTypes:                                # Config handle for each file types
    #   js:
    #     excludes: ['node_modules', 'dist'],
    #     commentTag: '///'
    #   ts:
    #     excludes: ['node_modules', 'dist'],
    #     commentTag: '///'
    # template: gitlab.wiki                     # Auto generate folders, files to specific templates. Default is 'github'
    # externalLinks:                            # Extra links. Example document api
    #   - name: Public api
    #     url: api_document/public
    #   - name: Internal api
    #     url: api_document/internal
```
2. Run
  - vscode extension
    1. Use shortcut
        ```sh
          ctrl+shift+t
          # OR
          cmd+opt+t
        ```
    2. `OR` Use file `.yaml`
        ```yaml
          - Dev:
            - Run Server: yarn dev
          - Sequence diagram:
            - Generate: ${PATH}/gen_seq_doc.yaml
        ```
  - CLI
    ```sh
      testapi6 ${PATH}/gen_seq_doc.yaml
    ```

# Components

1. Function
  - Default function
  - Startup function
  - Reference sequence diagram (which relate to each others)
2. Conditional
3. Loop
4. Parallel
5. Box
6. Group
7. Note
8. Class diagram
  1. Data model

> __All of command always start by default `$COMMENT_LINE/`__
You can change `$COMMENT_LINE` in file `.yaml`

Default:
- `javascript` is `///`
- `typescript` is `///`
- `golang` is `///`
- `java` is `///`
- `python` is `#/`

## 1. Function
_Includes actions to do something_

There are 2 function types:
1. `Startup function`: Defined functions which run at startup. In a startup function, function name always is empty
  - Syntax:
    ```typescript
      /// []{Context_Name1, Context_Name2}{Client_Name} Description
      OR
      /// [] Description
    ```
  - Example:
    ```typescript
      /// []{Worker} Worker to handle test message
      function main() {
        /// {Worker} > {MongoDB}: Get data in DB
        /// {Worker} <x {Worker}: Throw 400
        ...
      }

      @router('/get-somethings')
      /// []{Public, Internal} Public and internal APIs
      function clientRequestToGetSomething() {
        ...
      }
    ```
2. `Default function`: Functions which will be called by startup functions or other functions
  - Syntax:
    ```typescript
      /// [Function_Name]{Context_Name}{Client_Name} Description
    ```
  - Example:
    ```typescript
      /// [sayHello] This is hello function
      function sayHello(name: string) {
        console.log('Hello ' + name)
      }

      @router('/get-somethings')
      /// []{Public, Internal} Public and internal APIs
      function clientRequestToGetSomething() {
        /// [sayHello]
        sayHello('thanh')
      }
    ```
__Context__: 
  - If code run in API service => `Context_name` should be `App`...
    - If some APIs run both "public" and "intenral" => `Context_name` should be `Public, Internal`
    - If some APIs just exposed to public => `Context_name` should be `Public`
    - If some APIs just exposed to internal => `Context_name` should be `Internal`
  - If code run in Background service => `Context_name` should be `Worker`...
  
__Client__:
  - Object fires the first action
  
> `Context_Name`: which replaces `{}`. Default is `App` __(optional)__

> `Client_Name`: which replaces `{Client}`. Default is `Client` __(optional)__

3. `Reference sequence diagram` Reference sequence diagram to each others
- Syntax:
    ```typescript
      /// REF Function_Name
    ```
  - Example:
    ```typescript
      /// [sayHello] This is hello function
      function sayHello(name: string) {
        /// REF Handle say hello in worker
        console.log('Hello ' + name)
      }

      /// []{Worker} Handle say hello in worker
      function handleSayHello(name: string) {
        /// REF This is hello function
        console.log('Hello ' + name)
      }

      @router('/get-somethings')
      /// []{Public, Internal} Public and internal APIs
      function clientRequestToGetSomething() {
        /// [sayHello]
        sayHello('thanh')
      }
    ```

### Actions
  - `Call a function`
    - Syntax:
      ```typescript
      /// [function name]{Context_Name1, Context_Name2}{Client_Name}
      ```
    - Example:
      ```typescript
      function main() {
        /// [sayHello]{Worker}{Worker}
        sayHello('world')
      }
      ```
  > `Context_Name`: Set `{Context_Name}` to inner contexts in functions __(optional)__

  > `Client_Name`: Set `{Client_Name}` to inner contexts in functions __(optional)__
  - `Step by step in a function`
    - Syntax:
      ```typescript
      /// {} ACTION [Target]: Start do something
      ...
      /// {} ACTION [Target]: Result after done
      ```
    - `ACTION`:
      > `>`: Call to a next step

      > `<`: Return after a step done

      > `=>`: Make call/request to a service
      
      > `x>`: Make call/request to a service `then stop`

      > `<=`: Return after a call/request done

      > `<x`: Return after a call/request done `then stop`

      > `->`: Publish a message

      > `<-`: Consume a message

    - `TARGET`:
      > `{}`: is current context

      > `{.Target}`: Target is app context (Example: API call to Worker, all of them in a service. )

      > `{Client}`: is object fires the first action

      > `[Target]`: `[]` is described to database

      > `(Target)`: `()` is described to Redis, Kafka, RabbitMQ...

      > `{Target}`: `{}` is described to other services, client...

    - Example:
      ```typescript
      function main() {
        /// {} > [MySQL]: Get item by ID
        const item = await mysql.execute(...)
        /// {} < [MySQL]: Return Item{}

        /// {} > (Redis): Set name to cached
        await redis.set(...)
        /// {} < (Redis): Return

        /// {} => {Service 1}: Get items
        await fetch(...)
        /// {} <= {Service 1}: Return Item[]

        
        try {
          /// {Service 2} => {Service 1}: Get items
          await fetch(...)
        }
        /// IF get data from Service 1 error 
        catch (err) {
          /// {Service 2} <x {Service 1}: Throw 400 - Bad request
          throw new BadRequest(err.message)
        }
        /// {Service 2} <= {Service 1}: Return Item[]
      }
      ```

---

## 2. Conditional
- Keywords: `IF` | `ELSE`
- Syntax:
  ```typescript
  /// IF description
    ...
  /// ELSE description
    ...
  /// ELSE description
    ...
  ```
- Example:
  ```typescript
  /// IF Env is stag
  if (env === 'stag') {
    console.log('stag')
  }
  /// ELSE Env is production
  else if(env === 'prod') {
    console.log('prod')
  }
  /// ELSE Env is dev
  else {
    console.log('dev')
  }
  ```

## 3. For, loop
- Keywords: `LOOP`
- Syntax:
  ```typescript
  /// LOOP description
    ...
  ```
- Example:
  ```typescript
  /// LOOP Infinity to test
  while(true) {
    ...
  }
  ```

## 4. Parallel tasks
- Keywords: `PARALLEL`
- Syntax:
  ```typescript
  /// PARALLEL
    /// Do task 1
      ...
    /// Do task 2
      ...
    /// Do task n
      ...
  ```
- Example:
  ```typescript
  /// PARALLEL
  await Promise.all([
    /// Get user
    fetch(...),
    /// [getClass] Get class
    Class.getClass()
    /// Get product
    ///   {} > {ProductService}: Get a product
    fetch(...),
    ///   {} < {ProductService}: Return Product{}
  ])
  ```
## 5. Box
- Keywords: `BOX`
- Syntax:
  ```typescript
  /// BOX (RED, GREEN, BLUE)
    /// Do something here
      ...
  ```
- Example:
  ```typescript
  /// BOX (255, 0, 0)
  ///   LOOP Infinity to test
  while(true) {
    ...
  }
  ```

## 6. Group
- Keywords: `GROUP`
- Syntax:
  ```typescript
  /// GROUP Description
    /// Do something here
      ...
  ```
- Example:
  ```typescript
  /// GROUP Test logic
  ///   LOOP Infinity to test
  while(true) {
    ...
  }
  ```

## 7. Note
- Keywords: 
  - `NOTE RIGHT OF`
  - `NOTE LEFT OF`
  - `NOTE OVER`
- Syntax:
  ```typescript
    /// NOTE RIGHT OF {Target}: Content

    /// NOTE LEFT OF {Target}: Content

    /// NOTE OVER {Target1},{Target2}: Content
      ...
  ```
- Example:
  ```typescript
  while(true) {
    /// NOTE RIGHT OF {}: Validate first
    this.validate()
    /// NOTE LEFT OF [MongoDB]: Call to mongo to check something
    this.callToMongoDB()
    /// NOTE OVER {},(Redis)`: Need to insert something to mongo after validated successfully
    this.insertToMongo()
    ...
  }
  ```

## Data model
- Keywords: 
  - `<DATA_MODEL_NAME>`
- Syntax:
  ```typescript
    /// <MODEL_NAME> MODEL_TYPE: Model Description
      /// ATTRIBUTE_NAME1 TYPE1: Attr Description 1
      /// ATTRIBUTE_NAME2 TYPE2: Attr Description 2
  ```
- Example:
  ```typescript
    /// <Clazz> table: Class information
    class Clazz {
      /// id number
      id: number
      /// name string: Class name
      name: string
    }

    /// <StudentStatus> enum: Student status
    enum StudentStatus {
      /// ACTIVED 1: Student is actived
      ACTIVED = 1,
      /// INACTIVED 2: Student is blocked or not actived
      INACTIVED = 2,
    }

    /// <User> class User information
    class User {
      /// id number
      id: number
      /// name string: Full name
      name: string
    }

    /// <Student~User> table: Student information
    class Student extends User {
      /// class_id Clazz.id: Clazz of student
      clazz_id: number
      /// status StudentStatus: Student status
      status: number
    }
      ...
  ```

# Best practices
- [example result](../../test/examples/assets/seq_doc_comment/README)
- [example file](../../test/examples/assets/doc_sequence.js)
# testapi6
Utility tools for dev which run base on scenario yaml files

# Features
1. Test APIs base on scenario files `*.yaml`
2. Validate data after each steps
3. Re-use variable after each steps
4. Split a huge testcase to many small testcases which make easy to test in a big project
5. Easy to extends, customize for specific project
6. [Load external modules (mysql, postgreSQL, mongo, redis, grpc, rabbitmq...)](guide/external_module/README.md) or create tags by yourself
7. Support run benchmark via wrk
8. [Auto generate sequence diagram from any file base on comment](guide/doc_sequence/README.md)


# Practice
- See [examples](./test)
- Read [document details](https://doanthuanthanh88.github.io/testapi6/)

# Installation

### Visual code
- Install extension `doanthuanthanh88.testapi6`

### CLI
```sh
# install via npm
npm install -g testapi6
```
```sh
# install via yarn
yarn global add testapi6 --prefix /usr/local
```

### Docker
```sh
  docker pull doanthuanthanh88/testapi6
```


# How to run

## Visual code extension
1. Create a scenario files `*.yaml`
2. Open the scenario file 
3. Press `ctr+shift+t` or `cmd+opt+t`

## CLI
```sh
  testapi6 ${PATH_TO_SCENARIO_FILE}
```

## Docker

1. Run with `local scenario files`
```sh
  docker run --rm \
    -v $PWD/scenario_file.yaml:/test/index.yaml \
    -e {var_name_1}={value} \
    -e URL=http://urlhere... \
    doanthuanthanh88/testapi6
```

2. Run with `http scenario files`
```sh
  docker run --rm \
    -e {var_name_1}={value} \
    -e URL=http://urlhere... \
    doanthuanthanh88/testapi6 \
    http://.../scenario_file.yaml
```

3. Run with `scenario encrypted files` which need a password to decrypted before run
```sh
  docker run --rm \
    -v $PWD/scenario_file.yaml.encrypt:/test/index.yaml.encrypt \
    -e {var_name_1}={value} \
    -e URL=http://urlhere... \
    doanthuanthanh88/testapi6 \
    http://.../scenario_file.yaml \
    $PASSWORD
```

4. Run with some external modules
```sh
  docker run --rm \
  -v $PWD/test/examples/mock_data.yaml:/test/index.yaml \
  -e MODULES="testapi6-mockapi testapi6-sql" \
  doanthuanthanh88/testapi6
```

> The environment variables always override all of `vars` in Testcase file

# Scenario file example
```yaml
title:                      # Document title
description:                # Document description
developer: email@gmail.com  # Author
version: 1.0.0              # Document version
servers:                    # Example server in document
  production: https://prod.abc.vn/my-service/v1.0
  staging: https://staging.abc.vn/my-service/v1.0
  development: http://localhost:3001
# debug: true
vars:                               # Declare global variables
  url: http://0.0.0.0:3001
templates:                          # Declare templates which not run
  # Make request
  - Api:
  - Get:
  - Post:
  - Put:
  - Patch:
  - Delete:
  - Head:
  - Group:
steps:
  # Make request
  - Api:            # REST API
  - Get:            # API GET method
  - Delete:         # API DELETE method
  - Head:           # API HEAD method
  - Post:           # API POST method
  - Put:            # API PUT method
  - Patch:          # API PATCH method
  # Print
  - Echo:           # Print data
  - Schema:         # Print object schema
  # Logic
  - Script:         # Inject javascript in scenario
  - Vars:           # Declare global variables
  - Regex:          # Handle regex string
  # Validate
  - Validate:       # Validate logic
  - Validator:      # Create a new validator
  # Common
  - Pause:          # Pause or delay calls
  - Import:         # Import files
  - Load:           # Load data file then assign the value to a variable
  - Require:        # Load external module or embed code to create a new tags
  - Group:          # Group steps to manage
  - Exec:           # Execute external command
  - Utils:          # Utility functions
  - Define:         # Declare new Utils/Validate/Vars
  - Input:          # Get user input keyboard
  - OutputFile:     # Save data to file
  - DocSwagger:     # Save to swagger document
  - DocMarkdown:    # Save to markdown document
  - DocSequence:    # Generate to sequence diagram base on comments in code
  ...
```

### Support some tags
```yaml
!remove             # Remove item array when merge 
!keep               # Not override item in array when merge
!erase              # Delete field in object or item in array
!upload             # Incase upload file
```

# [Examples](./test)

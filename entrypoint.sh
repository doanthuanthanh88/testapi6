#!/bin/bash

if [[ ! -z "$MODULES" ]]; then
  echo "Installing external modules"
  echo $MODULES
  yarn global add $MODULES --slient
fi

testapi6 $1 $2

#!/bin/bash

grep -i version package.json | head -1  | cut -d ":" -f2 | cut -d "," -f1 | xargs || if [[ $? -eq 141 ]]; then true; else exit $?; fi
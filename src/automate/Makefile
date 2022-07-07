TS-SRC=$(shell find . -iname "*.ts" | grep -v node_modules)
NPM=npm
CURVE?=curve25519
BRIDGE?=fiat
METHOD?=square
EVALS?=10000
CYCLEGOAL?=10000
POPULATIONSIZE?=10
POPULATIONSHARE?=0.005
UNAME_S := $(shell uname -s)
CPUMASK?=ff

SEED?=0xdead
GEN_ARGS=--curve $(CURVE) --method $(METHOD) --seed $(SEED) --evals $(EVALS)  --cyclegoal $(CYCLEGOAL) --bridge $(BRIDGE) $(SKIPMIX) $(SKIPPROOF) --silent
POP_ARGS=$(GEN_ARGS) --populatio $(POPULATIONSIZE) --populatioratio $(POPULATIONSHARE)


# to save the cur_A.asm and tested_incorrect_.asms
.SECONDARY: %.asm
.PRECIOUS: %.asm

.PHONY: all clean populatio_dicentur generate_asm

all: install populatio_dicentur

./node_modules/typescript/bin/tsc: ./package.json measuresuite/configure
	/usr/bin/env $(NPM) install
	touch ${@}

measuresuite/configure: measuresuite/autogen.sh measuresuite/configure.ac
	cd measuresuite && ./autogen.sh

./node_modules/measuresuite/dist/index.js: measuresuite/configure
	cd measuresuite && /usr/bin/env $(NPM) run install

install: ./dist/generate_asm.js

./dist/generate_asm.js ./dist/populatio-dicentur.js &: ./node_modules/typescript/bin/tsc ./node_modules/measuresuite/dist/index.js $(TS-SRC)
	/usr/bin/env $(NPM) run compile
	make -s -C ./dist/bitcoin-core-bridge

generate_asm: ./dist/generate_asm.js
	taskset $(CPUMASK) ./dist/generate_asm.js $(GEN_ARGS)

populatio_dicentur: ./dist/populatio-dicentur.js
	taskset $(CPUMASK) ./dist/populatio-dicentur.js $(POP_ARGS)


check:
	/usr/bin/env $(NPM) test

clean: 
	$(MAKE) -C measuresuite clean
	rm -rf ./dist

distclean: clean
	$(MAKE) -C measuresuite distclean
	$(MAKE) -C bitcoin-core-bridge clean
	rm -rf node_modules results


MAKE_ROOT_DIR:=$(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
BIN_DIR=$(MAKE_ROOT_DIR)/bins
NODE=$(BIN_DIR)/node/bin/node
SEED?=$(shell date +%N)

ifeq ($(OS),Windows_NT)
$(error "windows not supported")
endif

UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
$(error "OS X not supported")
endif

ifeq ($(UNAME_S),Linux)
NODE_TAR_FLAGS=--xz
NODE_ARCH_FILE=.tar.xz
NODE_TYPE=linux
endif

NODE_VERSION=18.4.0

.PHONY: all distclean clean install optimize bar

all: optimize

$(NODE): Makefile
	mkdir -p $(BIN_DIR)
	rm -rf $(BIN_DIR)/node
	curl https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_TYPE}-x64.tar.xz | tar x $(NODE_TAR_FLAGS) -C ./bins
	mv -f ./bins/node-v${NODE_VERSION}-${NODE_TYPE}-x64 $(BIN_DIR)/node
	touch ${@}

install: $(NODE)
	PATH=$(BIN_DIR)/node/bin:$$PATH $(MAKE) -C automate install

#single run
optimize: $(NODE)
	PATH=$(BIN_DIR)/node/bin:$$PATH $(MAKE) -s -C automate SEED=$(SEED) generate_asm

#bet and run
bar: $(NODE)
	PATH=$(BIN_DIR)/node/bin:$$PATH $(MAKE) -s -C automate SEED=$(SEED) populatio_dicentur

check: $(NODE)
	PATH=$(BIN_DIR)/node/bin:$$PATH $(MAKE) -s -C automate check

clean:
	rm -rf  ./slurm* ./cur_*.asm ./tested_incorrect_*.asm
	$(MAKE) -C automate clean

distclean: clean
	rm -rf bins/node
	$(MAKE) -C automate distclean
	



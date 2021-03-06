'use babel';

const tmp = require('tmp');
const fs = require('fs');
const path = require('path');

export default {
  config: {
    // It should be noted that I, Kepler, hate these Config names. However these
    //  are the names in use by many people. Changing them for the sake of clean
    //  of clean code would cause a mess for our users. Because of this we
    //  override the titles the editor gives them in the settings pane.
    execPath: {
      type: 'string',
      default: 'clang',
    },
    clangIncludePaths: {
      type: 'array',
      default: ['.'],
    },
    clangSuppressWarnings: {
      type: 'boolean',
      default: false,
    },
    clangDefaultCFlags: {
      type: 'string',
      default: '-Wall',
    },
    clangDefaultCppFlags: {
      type: 'string',
      default: '-Wall -std=c++11',
    },
    clangDefaultObjCFlags: {
      type: 'string',
      default: '',
    },
    clangDefaultObjCppFlags: {
      type: 'string',
      default: '',
    },
    clangErrorLimit: {
      type: 'integer',
      default: 0,
    },
    verboseDebug: {
      type: 'boolean',
      default: false,
    },
  },

  activate: () => {
    require('atom-package-deps').install('linter-clang');
  },

  provideLinter: () => {
    const helpers = require('atom-linter');
    const clangFlags = require('clang-flags');
    const regex = '(?<file>.+):(?<line>\\d+):(?<col>\\d+):({(?<lineStart>\\d+):(?<colStart>\\d+)-(?<lineEnd>\\d+):(?<colEnd>\\d+)}.*:)? (?<type>[\\w \\-]+): (?<message>.*)';
    return {
      name: 'clang',
      grammarScopes: ['source.c', 'source.cpp', 'source.objc', 'source.objcpp'],
      scope: 'file',
      lintOnFly: true,
      lint: (activeEditor) => {
        const tmpObj = tmp.fileSync({postfix: '.cpp'});
        const tmpFile = tmpObj.name;

        return new Promise((resolve,reject) => {
          fs.write(tmpObj.fd, activeEditor.getText(), err => {
            if (err) reject(err);
            else resolve();
          })
        }).then(() => {
          const command = atom.config.get('linter-clang.execPath');
          const file = activeEditor.getPath();
          const [cwd, ] = atom.project.relativizePath(file);
          const args = ['-fsyntax-only',
            '-fno-caret-diagnostics',
            '-fno-diagnostics-fixit-info',
            '-fdiagnostics-print-source-range-info',
            '-fexceptions'];

          const grammar = activeEditor.getGrammar().name;

          if (/^C\+\+/.test(grammar)) {
            // const language = "c++";
            args.push('-xc++');
            args.push(...atom.config.get('linter-clang.clangDefaultCppFlags').split(/\s+/));
          }
          if (grammar === 'Objective-C++') {
            // const language = "objective-c++";
            args.push('-xobjective-c++');
            args.push(...atom.config.get('linter-clang.clangDefaultObjCppFlags').split(/\s+/));
          }
          if (grammar === 'C') {
            // const language = "c";
            args.push('-xc');
            args.push(...atom.config.get('linter-clang.clangDefaultCFlags').split(/\s+/));
          }
          if (grammar === 'Objective-C') {
            // const language = "objective-c";
            args.push('-xobjective-c');
            args.push(...atom.config.get('linter-clang.clangDefaultObjCFlags').split(/\s+/));
          }

          args.push(`-ferror-limit=${atom.config.get('linter-clang.clangErrorLimit')}`);
          if (atom.config.get('linter-clang.clangSuppressWarnings')) {
            args.push('-w');
          }
          if (atom.config.get('linter-clang.verboseDebug')) {
            args.push('--verbose');
          }

          atom.config.get('linter-clang.clangIncludePaths').forEach(p =>
            args.push(`-I${path.resolve(cwd, p)}`),
          );

          try {
            const flags = clangFlags.getClangFlags(activeEditor.getPath());
            if (flags) {
              args.push(...flags);
            }
          } catch (error) {
            if (atom.config.get('linter-clang.verboseDebug')) {
              // eslint-disable-next-line no-console
              console.log(error);
            }
          }

          // The file is added to the arguments last.
          args.push(tmpFile);
          const execOpts = {
            stream: 'stderr',
            allowEmptyStderr: true,
          };
          return helpers.exec(command, args, execOpts).then(output => {
              msgs = helpers.parse(output, regex);
              msgs.forEach(msg => {
                if(msg.filePath === tmpFile) {
                  msg.filePath = file;
                }
              });
              return msgs;
            }
          );
        });
      },
    };
  },
};

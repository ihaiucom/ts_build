
const typescript = require('rollup-plugin-typescript2');
const glsl = require('rollup-plugin-glsl');
const path = require('path');
const fs = require('fs');
var matched = require('matched');
const production = !process.env.ROLLUP_WATCH;
const gulp = require('gulp');
const rollup = require('rollup');
//处理文件流使用的插件
var through = require('through2');
//合并文件
var concat = require('gulp-concat'),pump = require('pump');
const uglify = require('gulp-uglify-es').default;
const rename = require('gulp-rename');
var Stream = require('stream');

var build_config = require('./build.config');
//编译新的库文件只需要在packsDef中配置一下新的库就可以了


var packsDef = [
    {
        'libName': "core",
        'input': [
            '../src/**/*.ts'
        ],
        'out': `../build/js/libs/${build_config.fileName}.js`
    }
];

var curPackFiles = null;  //当前包的所有的文件
var mentry = 'multientry:entry-point';
function myMultiInput() {
    var include = [];
    var exclude = [];
    function configure(config) {
        if (typeof config === 'string') {
            include = [config];
        } else if (Array.isArray(config)) {
            include = config;
        } else {
            include = config.include || [];
            exclude = config.exclude || [];

            if (config.exports === false) {
                exporter = function exporter(p) {
                    if (p.substr(p.length - 3) == '.ts') {
                        p = p.substr(0, p.length - 3);
                    }
                    return `import ${JSON.stringify(p)};`;
                };
            }
        }
    }

    var exporter = function exporter(p) {
        if (p.substr(p.length - 3) == '.ts') {
            p = p.substr(0, p.length - 3);
        }
        return `export * from ${JSON.stringify(p)};`;
    };

    return (
        {
            options(options) {
                console.log('===', options.input)
                configure(options.input);
                options.input = mentry;
            },

            resolveId(id, importer) {//entry是个特殊字符串，rollup并不识别，所以假装这里解析一下
                if (id === mentry) {
                    return mentry;
                }
                if (mentry == importer)
                    return;
                var importfile = path.join(path.dirname(importer), id);
                var ext = path.extname(importfile);
                if (ext != '.ts' && ext != '.glsl' && ext != '.vs' && ext != '.ps' && ext != '.fs') {
                    importfile += '.ts';
                }
                //console.log('import ', importfile);
                if (curPackFiles.indexOf(importfile) < 0) {
                    //其他包里的文件
                    // console.log('other pack:',id,'importer=', importer);
                    return build_config.moduleName;
                }
            },
            load(id) {
                if (id === mentry) {
                    if (!include.length) {
                        return Promise.resolve('');
                    }

                    var patterns = include.concat(exclude.map(function (pattern) {
                        return '!' + pattern;
                    }));
                    return matched.promise(patterns, { realpath: true }).then(function (paths) {
                        curPackFiles = paths;   // 记录一下所有的文件
                        paths.sort();
                        return paths.map(exporter).join('\n');
                    });
                } else {
                    //console.log('load ',id);
                }
            }
        }
    );
}

//修改引擎库
gulp.task('ModifierJs', () => {
    for (let i = 0; i < packsDef.length; ++i) {
        if (i !== packsDef.length - 1) {
            gulp.src([packsDef[i].out])
                .pipe(through.obj(function (file, encode, cb) {
                    var srcContents = "";
                    var srcContents = file.contents.toString();
                    var re = new RegExp(`var ${build_config.moduleName} `);
                    var destContents = srcContents.replace(re, `window.${build_config.moduleName}`);
                    
                    var re = new RegExp(`\\(this.${build_config.moduleName} = this.${build_config.moduleName} \\|\\| {}\\)\\);`);
                    // /\(this.Laya = this.Laya \|\| {}, Laya\)\);/
                        destContents = destContents.replace(re, `(window.${build_config.moduleName} = window.${build_config.moduleName} || {}, ${build_config.moduleName}));`);
                        
                    // 再次转为Buffer对象，并赋值给文件内容
                    file.contents = Buffer.from(destContents);
                    // 以下是例行公事
                    this.push(file)
                    cb()
                }))
                .pipe(gulp.dest('../build/js/libs/'));
        }else{
            return gulp.src([packsDef[i].out])
            .pipe(through.obj(function (file, encode, cb) {
                var srcContents = file.contents.toString();
                var re = new RegExp(`var ${build_config.moduleName} `);
                var destContents = srcContents.replace(re, `window.${build_config.moduleName}`);
                 var re = new RegExp(`\\(this.${build_config.moduleName} = this.${build_config.moduleName} \\|\\| {}\\)\\);`);
                // /\(this.Laya = this.Laya \|\| {}, Laya\)\);/
                    destContents = destContents.replace(re, `(window.${build_config.moduleName} = window.${build_config.moduleName} || {}, ${build_config.moduleName}));`);
                    
                // destContents = destContents.replace(/\(this.Engine = this.Engine \|\| {}\)\);/, `(window.${build_config.moduleName} = window.${build_config.moduleName} || {}, ${build_config.moduleName}));`);
                // 再次转为Buffer对象，并赋值给文件内容
                file.contents = Buffer.from(destContents);
                // 以下是例行公事
                this.push(file)
                cb()
            }))
            .pipe(gulp.dest('../build/js/libs/'));
        }
    }
});







//在这个任务中由于机器的配置可能会出现堆栈溢出的情况，解决方案一可以将其中的某些库移送至buildJS2编译，若buildJS2也堆栈溢出，则可以再新建一个任务buildJS3
gulp.task('buildJS', async function () {
    for (let i = 0; i < packsDef.length; ++i) {
        const subTask = await rollup.rollup({
            input: packsDef[i].input,
            output: {
                extend: true,
                globals: { [build_config.moduleName]: build_config.moduleName }
            },
            external: [build_config.moduleName],
            plugins: [
                myMultiInput(),
                typescript({
                    include: /.*(.d.ts|.ts|.js)$/,
                    tsconfig: "../src/tsconfig.json",
                    check: false,
                    tsconfigOverride: { compilerOptions: { removeComments: true } }
                }),
                glsl({
                    include: /.*(.glsl|.vs|.fs)$/,
                    sourceMap: false,
                    compress: false
                }),
            ]
        }).catch(e => {
            console.log(e);
        });

        if (packsDef[i].libName == "core") {
            await subTask.write({
                file: packsDef[i].out,
                format: 'iife',
                // outro: 'exports.static=_static;',  //由于static是关键字，无法通过ts编译。AS需要这个函数，临时强插
                name: build_config.moduleName,
                sourcemap: false
            });
        }
        else {
            await subTask.write({
                file: packsDef[i].out,
                format: 'iife',
                name: build_config.moduleName,
                sourcemap: false,
                extend: true,
                globals: { [build_config.moduleName]: build_config.moduleName }
            });

        }
    }
});


// 压缩
// 下面两个方法，最好能合并
gulp.task("compressJs", function () {

    return gulp.src(["../build/js/libs/*.js"])
        .pipe(uglify({
            mangle: {
                keep_fnames: true
            }
        }))
        .on('error', function (err) {
            console.warn(err.toString());
        })
        .pipe(gulp.dest("../build/js/libs/min"))
});


gulp.task('build', 
gulp.series('buildJS' , 'ModifierJs'
// , 'compressJs'
 ));


const gulp = require('gulp');
const del = require('del');
const ts = require('gulp-typescript');

const outDir = 'dist';

gulp.task('clean', del.bind(null, [outDir]));

gulp.task('compile', () => {
    const proj = ts.createProject('tsconfig.json');
    return gulp.src("src/**/*.ts")
    .pipe(proj()).js
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['compile']);

const gulp = require('gulp');

const replace = require('gulp-replace');

copyDevConfig  = () => {
  let Config = require('./server/config/config.dev.json');
  let facebook_auth_client_id = Config.facebook.auth_client_id
  gulp.src('./src/app/shared/shared.module.ts')
  .pipe(replace('542621762941352', facebook_auth_client_id))
  .pipe(gulp.dest('./src/app/shared/'));
  gulp.src('./src/index.html')
  .pipe(replace('<title>SimpiliSponsor</title>', '<title>DigitalSmart</title>'))
  .pipe(gulp.dest('./src/'));
  return gulp.src('./src/app/service/business.service.ts')
  .pipe(replace( "SCHOOL",'#BUSSINESS#'))
  .pipe(gulp.dest('./src/app/service/'));
}

copyDevSchoolConfig  = () => {
  let Config = require('./server/config/config.school.dev.json');
  let facebook_auth_client_id = Config.facebook.auth_client_id
   gulp.src('./src/app/shared/shared.module.ts')
  .pipe(replace('542621762941352', facebook_auth_client_id))
  .pipe(gulp.dest('./src/app/shared/'));
  gulp.src('./src/index.html')
  .pipe(replace('<title>DigitalSmart</title>', '<title>SimpiliSponsor</title>'))
  .pipe(gulp.dest('./src/'));
  return gulp.src('./src/app/service/business.service.ts')
  .pipe(replace('#BUSSINESS#', "SCHOOL"))
  .pipe(gulp.dest('./src/app/service/'));
}

copyNightlySchoolConfig  = () => {
  let Config = require('./server/config/config.school.nightly.json');
  let facebook_auth_client_id = Config.facebook.auth_client_id
  gulp.src('./src/app/shared/shared.module.ts')
  .pipe(replace('542621762941352', facebook_auth_client_id))
  .pipe(gulp.dest('./src/app/shared/'));
  gulp.src('./src/index.html')
  .pipe(replace('<title>DigitalSmart</title>', '<title>SimpiliSponsor</title>'))
  .pipe(gulp.dest('./src/'));
  return gulp.src('./src/app/service/business.service.ts')
  .pipe(replace('#BUSSINESS#', "SCHOOL"))
  .pipe(gulp.dest('./src/app/service/'));
}

copyNightlyConfig  = () => {
  let Config = require('./server/config/config.nightly.json');
  let facebook_auth_client_id = Config.facebook.auth_client_id
  gulp.src('./src/app/shared/shared.module.ts')
  .pipe(replace('542621762941352', facebook_auth_client_id))
  .pipe(gulp.dest('./src/app/shared/'));
  gulp.src('./src/index.html')
  .pipe(replace('<title>SimpiliSponsor</title>', '<title>DigitalSmart</title>'))
  .pipe(gulp.dest('./src/'));
  return gulp.src('./src/app/service/business.service.ts')
  .pipe(replace( "SCHOOL",'#BUSSINESS#'))
  .pipe(gulp.dest('./src/app/service/'));
}

copyProdConfig = () => {
  let Config = require('./server/config/config.prod.json');
  let facebook_auth_client_id = Config.facebook.auth_client_id
  return gulp.src('./src/app/shared/shared.module.ts')
  .pipe(replace('542621762941352', facebook_auth_client_id))
  .pipe(gulp.dest('./src/app/shared/'));
}

let serve = gulp.series(copyDevConfig);

let serveSchool = gulp.series(copyDevSchoolConfig);

let nightly = gulp.series(copyNightlyConfig);

let nightlySchool = gulp.series(copyNightlySchoolConfig);

let prod = gulp.series(copyProdConfig);

gulp.task('serve', serve);

gulp.task('serveSchool', serveSchool);

gulp.task('nightlySchool', nightlySchool);

gulp.task('nightly', nightly);

gulp.task('prod', prod);
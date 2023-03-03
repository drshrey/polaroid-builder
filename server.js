// get the contents of a github repo
var github = require('octonode');
var fs = require('fs');
const { execSync, exec } = require('child_process');

var client = github.client('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');
var ghrepo = client.repo('drshrey/polaroid-example-rails-app');

const dirname = 'drshrey/polaroid-example-rails-app'

function worker() {
    console.log("Running worker at " + new Date().toISOString());

    var changed = false;

    // check if Gemfile is different than what is in the file
    ghrepo.contents('Gemfile', function(err, data, headers) {
        console.log(err, data)
        // check if file exists in filesystem
        if (!fs.existsSync(dirname) || !fs.existsSync(dirname + '/Gemfile')) {
            // write the content to a file
            fs.mkdirSync(dirname, { recursive: true });
            // decode data.content from base64 to ascii
            var decodedContent = Buffer.from(data.content, 'base64').toString('ascii');
            fs.writeFile(dirname + '/Gemfile', data.content, function (err) {
                if (err) return console.log(err);
                console.log('Gemfile written');
            });

            pushImageToRegistry();
        } else {
            // check if the content is different
            fs.readFile(dirname + '/Gemfile', 'utf8', function (err,fileData) {
                if (err) {
                    return console.log(err);
                }
                // check if content is different from what is in the file
                if (data.content !== fileData) {
                    fs.writeFile(dirname + '/Gemfile', data.content, function (err) {
                        if (err) return console.log(err);
                        console.log('Gemfile written');
                    });

                    console.log("Gemfile changed, rebuilding image");
                    // build a docker image and push it to a registry
                    changed = true;
                    pushImageToRegistry();
                } else {
                    console.log("Gemfile is same, no rebuild necessary")
                }
            });
        }
    });

    if(changed) {
        console.log("Already built from changed Gemfile, skipping Dockerfile check");
        return
    }

    ghrepo.contents('Dockerfile', function(err, data, headers) {
        // check if file exists in filesystem
        if (!fs.existsSync(dirname) || !fs.existsSync(dirname + '/Dockerfile')) {
            // write the content to a file
            fs.mkdirSync(dirname, { recursive: true });
            // decode data.content from base64 to ascii
            var decodedContent = Buffer.from(data.content, 'base64').toString('ascii');
            fs.writeFile(dirname + '/Dockerfile', data.content, function (err) {
                if (err) return console.log(err);
                console.log('Dockerfile written');
            });

            pushImageToRegistry();
        } else {
            // check if the content is different
            fs.readFile(dirname + '/Dockerfile', 'utf8', function (err,fileData) {
                if (err) {
                    return console.log(err);
                }
                // check if content is different from what is in the file
                if (data.content !== fileData) {
                    fs.writeFile(dirname + '/Dockerfile', data.content, function (err) {
                        if (err) return console.log(err);
                        console.log('Dockerfile written');
                    });

                    console.log("Dockerfile changed, rebuilding image");
                    // build a docker image and push it to a registry
                    pushImageToRegistry();
                } else {
                    console.log("Dockerfile is same, no rebuild necessary")
                }
            });
        }
    });

    function pushImageToRegistry() {
        // build a docker image and push it to a registry
        // Define Dockerfile path, image name and tag, and registry URL

        const repoUrl = 'https://github.com/drshrey/polaroid-example-rails-app.git';
        const targetDir = './drshrey/polaroid-example-rails-app';

        if (!fs.existsSync(targetDir)) {
            execSync(`git clone ${repoUrl} polaroid-example-rails-app`);
        } else {
            execSync(`cd polaroid-example-rails-app && git pull`);
        }

        const dockerfilePath = 'drshrey/polaroid-example-rails-app/Dockerfile';
        const imageName = dirname.split('/').join('-');
        const imageTag = Date.now().toString();
        const registryUrl = 'drshrey';

        // TODO: Read from Gemfile.lock instead of Gemfile
        // add Gemfile deps to end of dockerfile for install (cuz we're slick like dat)
        // get gemfile dependencies from Gemfile into an array
        const gemfile = fs.readFileSync('drshrey/polaroid-example-rails-app/Gemfile', 'utf8');
        const gemfileLines = gemfile.split('\n');
        const gemfileDeps = [];
        gemfileLines.forEach(line => {
            if (line.startsWith('gem')) {
                gemfileDeps.push({
                    name: line.split(' ')[1].replace(/'/g, '').replace(',', ''),
                    version: line.split(' ')[2].replace(/'/g, '').replace(',', '')
                });
            }
        });

        console.log(gemfileDeps);

        // append 'gem install' commands to end of dockerfile
        const dockerfile = fs.readFileSync('drshrey/polaroid-example-rails-app/Dockerfile', 'utf8');
        const dockerfileLines = dockerfile.split('\n');
        gemfileDeps.forEach(dep => {
            dockerfileLines.push(`RUN gem install ${dep.name} -v ${dep.version}`);
        });

        const newDockerfile = dockerfileLines.join('\n');
        console.log(newDockerfile)

        fs.writeFileSync('drshrey/polaroid-example-rails-app/Dockerfile', newDockerfile);


        const loginCommand = `docker login -u ${process.env.DOCKER_USERNAME} -p ${process.env.DOCKER_PASSWORD}`;
        const loginOutput = execSync(loginCommand);
        console.log(loginOutput.toString());

        // Build Docker image
        const buildCommand = `docker build -t drshrey/${imageName}:${imageTag} -f ${dockerfilePath} drshrey/polaroid-example-rails-app`;
        const buildOutput = execSync(buildCommand);
        console.log(buildOutput.toString());

        // Tag Docker image with registry URL
        const tagCommand = `docker tag drshrey/${imageName}:${imageTag} ${imageName}:${imageTag}`;
        const tagOutput = execSync(tagCommand);
        console.log(tagOutput.toString());

        // Push Docker image to registry
        const pushCommand = `docker push drshrey/${imageName}:${imageTag}`;
        const pushOutput = execSync(pushCommand);
        console.log(pushOutput.toString());

        fs.writeFileSync('drshrey/polaroid-example-rails-app/Dockerfile', dockerfile);
    }
}

worker()

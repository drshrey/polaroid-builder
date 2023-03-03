// get the contents of a github repo
var github = require('octonode');
var fs = require('fs');
const { execSync, exec } = require('child_process');

var client = github.client();
var ghrepo = client.repo('drshrey/rails-dockerfiles');

const dirname = 'drshrey/rails-dockerfiles/alpine3.11'

function worker() {
    console.log("Running worker at " + new Date().toISOString());
    ghrepo.contents('alpine3.11/Dockerfile', function(err, data, headers) {
        // check if file exists in filesystem
        if (!fs.existsSync(dirname)) {
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
                // check if content is different than what is in the file
                if (data.content !== fileData) {
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

        const repoUrl = 'https://github.com/drshrey/rails-dockerfiles.git';
        const targetDir = './rails-dockerfiles';

        if (!fs.existsSync(targetDir)) {
            execSync(`git clone ${repoUrl} rails-dockerfiles`);
        }

        const dockerfilePath = 'rails-dockerfiles/alpine3.11/Dockerfile';
        const imageName = dirname.split('/').join('-');
        const imageTag = 'latest';
        const registryUrl = 'drshrey';

        const loginCommand = `docker login -u ${process.env.DOCKER_USERNAME} -p ${process.env.DOCKER_PASSWORD}`;
        const loginOutput = execSync(loginCommand);
        console.log(loginOutput.toString());

        // Build Docker image
        const buildCommand = `docker build -t drshrey/${imageName}:${imageTag} -f ${dockerfilePath} rails-dockerfiles/alpine3.11/`;
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
    }
}

console.log("Starting worker")
setInterval(worker, 10000);

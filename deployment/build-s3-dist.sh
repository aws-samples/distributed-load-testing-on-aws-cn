#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -e

sedi()
{
    # cross-platform for sed -i
    sed -i $* 2>/dev/null || sed -i "" $*
}

__dir="$(cd "$(dirname $0)";pwd)"
SRC_PATH="${__dir}/../source"
CDK_OUT_PATH="${__dir}/cdk.out"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Parameters not enough"
    echo "Example: $(basename $0) <BUCKET_NAME> <SOLUTION_NAME> [VERSION]"
    exit 1
fi

export BUCKET_NAME=$1
export SOLUTION_NAME=$2
if [ -z "$3" ]; then
    # export VERSION="v$(jq -r '.version' ${SRC_PATH}/version.json)"
    export VERSION=$(git describe --tags || echo latest)
else
    export VERSION=$3
fi
export GLOBAL_S3_ASSETS_PATH="${__dir}/global-s3-assets"
export REGIONAL_S3_ASSETS_PATH="${__dir}/regional-s3-assets"

# Get reference for all important folders
template_dir="${__dir}"
template_dist_dir="${GLOBAL_S3_ASSETS_PATH}"
build_dist_dir="${REGIONAL_S3_ASSETS_PATH}"
source_dir="${SRC_PATH}"

echo "------------------------------------------------------------------------------"
echo "Rebuild distribution"
echo "------------------------------------------------------------------------------"
rm -rf $template_dist_dir
mkdir -p $template_dist_dir
rm -rf $build_dist_dir
mkdir -p $build_dist_dir

[ -e $template_dist_dir ] && rm -r $template_dist_dir
[ -e $build_dist_dir ] && rm -r $build_dist_dir
mkdir -p $template_dist_dir $build_dist_dir

echo "BUCKET_NAME=${BUCKET_NAME}"
echo "SOLUTION_NAME=${SOLUTION_NAME}"
echo "VERSION=${VERSION}"
echo "${VERSION}" > ${GLOBAL_S3_ASSETS_PATH}/version

echo "------------------------------------------------------------------------------"
echo "CloudFormation Template"
echo "------------------------------------------------------------------------------"
cp $template_dir/distributed-load-testing-on-aws.yaml $template_dist_dir/distributed-load-testing-on-aws.template

replace="s/CODE_BUCKET/$BUCKET_NAME/g"
echo "sedi $replace"
sedi $replace $template_dist_dir/distributed-load-testing-on-aws.template
replace="s/SOLUTION_NAME/$SOLUTION_NAME/g"
echo "sedi $replace"
sedi $replace $template_dist_dir/distributed-load-testing-on-aws.template
replace="s/CODE_VERSION/$VERSION/g"
echo "sedi $replace"
sedi $replace $template_dist_dir/distributed-load-testing-on-aws.template

echo "------------------------------------------------------------------------------"
echo "Creating custom-resource deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/custom-resource/
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 ../../deployment/regional-s3-assets/custom-resource.zip *

echo "------------------------------------------------------------------------------"
echo "Creating api-services deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/api-services
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/api-services.zip *

echo "------------------------------------------------------------------------------"
echo "Creating results-parser deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/results-parser
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/results-parser.zip *

echo "------------------------------------------------------------------------------"
echo "Creating task-runner deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/task-runner
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/task-runner.zip *

echo "------------------------------------------------------------------------------"
echo "Creating task-status-checker deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/task-status-checker
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/task-status-checker.zip *

echo "------------------------------------------------------------------------------"
echo "Creating ecr-checker deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/ecr-checker
rm -rf node_modules/
npm install --production
rm package-lock.json
zip -q -r9 $build_dist_dir/ecr-checker.zip *

echo "------------------------------------------------------------------------------"
echo "Creating container deployment package"
echo "------------------------------------------------------------------------------"
cd $source_dir/container
# Downloading jetty 9.4.34.v20201102
curl -O https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-alpn-client/9.4.34.v20201102/jetty-alpn-client-9.4.34.v20201102.jar
curl -O https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-alpn-openjdk8-client/9.4.34.v20201102/jetty-alpn-openjdk8-client-9.4.34.v20201102.jar
curl -O https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-client/9.4.34.v20201102/jetty-client-9.4.34.v20201102.jar
curl -O https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-http/9.4.34.v20201102/jetty-http-9.4.34.v20201102.jar
curl -O https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-io/9.4.34.v20201102/jetty-io-9.4.34.v20201102.jar
curl -O https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-util/9.4.34.v20201102/jetty-util-9.4.34.v20201102.jar
zip -q -r9 ../../deployment/regional-s3-assets/container.zip *
cp container-manifest.json $build_dist_dir/
rm -f *.jar

echo "------------------------------------------------------------------------------"
echo "Building console"
echo "------------------------------------------------------------------------------"
cd $source_dir/console
[ -e build ] && rm -r build
[ -e node_modules ] && rm -rf node_modules
npm install
npm run build
mkdir $build_dist_dir/console
cp -r ./build/* $build_dist_dir/console/

echo "------------------------------------------------------------------------------"
echo "Generate console manifest file"
echo "------------------------------------------------------------------------------"
cd $build_dist_dir
manifest=(`find console -type f | sed 's|^./||'`)
manifest_json=$(IFS=,;printf "%s" "${manifest[*]}")
echo "[\"$manifest_json\"]" | sed 's/,/","/g' > ./console-manifest.json

echo "------------------------------------------------------------------------------"
echo "Build S3 Packaging Complete"
echo "------------------------------------------------------------------------------"

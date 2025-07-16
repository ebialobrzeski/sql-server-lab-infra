#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const sql_server_training_stack_1 = require("../lib/sql-server-training-stack");
const app = new cdk.App();
const scope = app.node.tryGetContext('scope');
if (!scope) {
    throw new Error('You must provide a --context scope=yourname to deploy this stack.');
}
new sql_server_training_stack_1.SqlServerTrainingStack(app, `${scope}-SqlServerTrainingStack`);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FsLXNlcnZlci10cmFpbmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNxbC1zZXJ2ZXItdHJhaW5pbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxpREFBbUM7QUFDbkMsZ0ZBQTBFO0FBRTFFLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsbUVBQW1FLENBQUMsQ0FBQztBQUN2RixDQUFDO0FBRUQsSUFBSSxrREFBc0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLHlCQUF5QixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXHJcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCB7IFNxbFNlcnZlclRyYWluaW5nU3RhY2sgfSBmcm9tICcuLi9saWIvc3FsLXNlcnZlci10cmFpbmluZy1zdGFjayc7XHJcblxyXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xyXG5cclxuY29uc3Qgc2NvcGUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzY29wZScpO1xyXG5pZiAoIXNjb3BlKSB7XHJcbiAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwcm92aWRlIGEgLS1jb250ZXh0IHNjb3BlPXlvdXJuYW1lIHRvIGRlcGxveSB0aGlzIHN0YWNrLicpO1xyXG59XHJcblxyXG5uZXcgU3FsU2VydmVyVHJhaW5pbmdTdGFjayhhcHAsIGAke3Njb3BlfS1TcWxTZXJ2ZXJUcmFpbmluZ1N0YWNrYCk7XHJcbiJdfQ==
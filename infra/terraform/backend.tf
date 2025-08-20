terraform {
  backend "s3" {
    bucket         = "beacon-terraform-state-2ex762oh"
    key            = "beacon/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt        = true
    dynamodb_table = "beacon-terraform-locks"
  }
}

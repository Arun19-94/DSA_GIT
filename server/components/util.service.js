const fs = require('fs');

this.deleteFolderRecursive = (path) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file, index) => {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        this.deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

this.skipSpecialChar = (value) => {
  value = value.replace("\\", "\\\\")
  value = value.replace("*", "\\*")
  value = value.replace("(", "\\(")
  value = value.replace(")", "\\)")
  value = value.replace("+", "\\+")
  value = value.replace("[", "\\[")
  value = value.replace("|", "\\|")
  value = value.replace(",", "\\,")
  value = value.replace(".", "\\.")
  value = value.replace("?", "\\?")
  value = value.replace("^", "\\^")
  value = value.replace("$", "\\$")
  return value;
}
import path from "path";

export function getAbsolutePath(relativePath: string) {
    const cwd = process.cwd();
    return path.join(cwd, relativePath);
}
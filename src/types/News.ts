export interface News {
    [key: string]: New
}

export interface New {
    "title-icon": string,
    "image": string,
    "title": string,
    "sub-title": string,
    "description": string,
}
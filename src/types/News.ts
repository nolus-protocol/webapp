export interface News {
    [key: string]: New
}

export interface New {
    "title-icon": string,
    "image": string,
    "title": string,
    "subtitle": string,
    "description": string,
    "target": string
}
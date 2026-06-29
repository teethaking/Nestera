export class CacheInvalidationEvent {
  constructor(
    public readonly key: string,
    public readonly tags?: string[],
    public readonly pattern?: string,
  ) {}
}

export class CacheInvalidationByTagEvent {
  constructor(public readonly tag: string) {}
}

export class CacheInvalidationByPatternEvent {
  constructor(public readonly pattern: string) {}
}

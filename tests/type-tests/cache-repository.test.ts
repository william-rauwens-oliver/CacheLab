import type { CacheRepository } from "../../src/application/ports/cache-repository.js";
import type {
  CreateError,
  DeleteError,
  GetError,
  UpdateError
} from "../../src/domain/cache-types.js";

type Equal<Left, Right> =
  (<Type>() => Type extends Left ? 1 : 2) extends
  (<Type>() => Type extends Right ? 1 : 2)
    ? true
    : false;

type Expect<Type extends true> = Type;

type FailureOf<Type> = Type extends {
  readonly ok: false;
  readonly error: infer ErrorType;
}
  ? ErrorType
  : never;

type ValueOf<Type> = Type extends {
  readonly ok: true;
  readonly value: infer ValueType;
}
  ? ValueType
  : never;

type CreateResult = ReturnType<CacheRepository["create"]>;
type GetResult = ReturnType<CacheRepository["get"]>;
type UpdateResult = ReturnType<CacheRepository["update"]>;
type DeleteResult = ReturnType<CacheRepository["delete"]>;

type CreateErrorsAreExact = Expect<Equal<FailureOf<CreateResult>, CreateError>>;
type GetErrorsAreExact = Expect<Equal<FailureOf<GetResult>, GetError>>;
type UpdateErrorsAreExact = Expect<Equal<FailureOf<UpdateResult>, UpdateError>>;
type DeleteErrorsAreExact = Expect<Equal<FailureOf<DeleteResult>, DeleteError>>;
type GetValueIsString = Expect<Equal<ValueOf<GetResult>, string>>;

export type CacheRepositoryContractAssertions =
  | CreateErrorsAreExact
  | GetErrorsAreExact
  | UpdateErrorsAreExact
  | DeleteErrorsAreExact
  | GetValueIsString;

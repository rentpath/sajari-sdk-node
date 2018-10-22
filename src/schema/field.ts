import merge from "deepmerge";
import { sajari } from "../../generated/proto";

/**
 * Field represents a meta field which can be assigned in a collection record.
 */
export interface Field {
  // Name is the name used to identify the field.
  name: string;

  // Description is a description of the field.
  description: string;

  // Type defines the type of the field.
  type: Type;

  mode: FieldMode;

  /**
   * deprecated
   * @hidden
   */
  required: boolean;
  /**
   * deprecated
   * @hidden
   */
  unique: boolean;

  // Repeated indicates that this field can hold a list of values.
  repeated: boolean;

  // Indexed indicates that the field should be indexed.
  indexed?: boolean;
}

/**
 * Type represents the underlying data type of the field. Default is a string.
 * @hidden
 */
export enum Type {
  String = "STRING",
  Integer = "INTEGER",
  Float = "FLOAT",
  Double = "DOUBLE",
  Boolean = "BOOLEAN",
  Timestamp = "TIMESTAMP"
}

export enum FieldMode {
  /**
   * Nullable fields do not need to be set.
   */
  Nullable = sajari.engine.schema.Field.Mode.NULLABLE,
  /**
   * Required fields must be specified (cannot be null).
   */
  Required = sajari.engine.schema.Field.Mode.REQUIRED,
  /**
   * Unique fields must be specified, and must be unique.
   * Unique fields can be used to retrieve/delete records.
   */
  Unique = sajari.engine.schema.Field.Mode.UNIQUE
}

interface FieldOptions {
  // Description is a description of the field.
  description: string;

  // Repeated indicates that this field can hold a list of values.
  repeated: boolean;

  mode: FieldMode;

  /**
   * deprecated
   * @hidden
   */
  required: boolean;
  /**
   * deprecated
   * @hidden
   */
  unique: boolean;
}

/**
 * @hidden
 */
const defaultFieldOptions: FieldOptions = {
  description: "",
  repeated: false,
  mode: FieldMode.Nullable,
  required: false,
  unique: false
};

/**
 * @hidden
 */
function field(type: Type, name: string, options: FieldOptions): Field {
  options = merge(defaultFieldOptions, options || {});

  switch (options.mode) {
    case FieldMode.Required:
      options.required = true;
      break;
    case FieldMode.Unique:
      options.unique = true;
    default:
      break;
  }

  return {
    type,
    name,
    description: options.description,
    repeated: options.repeated,
    mode: options.mode,
    unique: options.unique,
    required: options.required
  };
}

/**
 * @hidden
 */
export function string(name: string, options: FieldOptions): Field {
  return field(Type.String, name, options);
}

/**
 * @hidden
 */
export function integer(name: string, options: FieldOptions): Field {
  return field(Type.Integer, name, options);
}

/**
 * @hidden
 */
export function float(name: string, options: FieldOptions): Field {
  return field(Type.Float, name, options);
}

/**
 * @hidden
 */
export function double(name: string, options: FieldOptions): Field {
  return field(Type.Double, name, options);
}

/**
 * @hidden
 */
export function boolean(name: string, options: FieldOptions): Field {
  return field(Type.Boolean, name, options);
}

/**
 * @hidden
 */
export function timestamp(name: string, options: FieldOptions): Field {
  return field(Type.Timestamp, name, options);
}

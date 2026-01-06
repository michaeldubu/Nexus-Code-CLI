package nexus.saaamllc.plugin.mcp

import kotlinx.serialization.*
import kotlinx.serialization.json.*
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*

/**
 * MCP JSON-RPC 2.0 Protocol Implementation
  */

// ========== Base Message Types ==========

@Serializable(with = JSONRPCMessagePolymorphicSerializer::class)
sealed interface JSONRPCMessage

@Serializable
data class JSONRPCRequest(
    val id: RequestId,
    val method: String,
    val params: JsonElement = JsonObject(emptyMap()),
    val jsonrpc: String = "2.0"
) : JSONRPCMessage

@Serializable
data class JSONRPCResponse(
    val id: RequestId,
    val jsonrpc: String = "2.0",
    val result: JsonElement? = null,
    val error: JSONRPCError? = null
) : JSONRPCMessage

@Serializable
data class JSONRPCNotification(
    val method: String,
    val params: JsonElement = JsonObject(emptyMap()),
    val jsonrpc: String = "2.0"
) : JSONRPCMessage

@Serializable
data class JSONRPCError(
    val code: Int,
    val message: String,
    val data: JsonElement? = null
)

// ========== Request ID Types ==========

@Serializable(with = RequestIdSerializer::class)
sealed class RequestId {
    @Serializable
    data class NumberId(val value: Int) : RequestId()

    @Serializable
    data class StringId(val value: String) : RequestId()
}

// ========== Tool Types ==========

@Serializable
data class CallToolRequest(
    val name: String,
    val arguments: JsonObject = JsonObject(emptyMap())
)

@Serializable
data class CallToolResult(
    val content: List<TextContent>,
    val isError: Boolean? = null
)

@Serializable
data class TextContent(
    val type: String = "text",
    val text: String
)

@Serializable
data class Tool(
    val name: String,
    val description: String,
    val inputSchema: JsonObject
)

@Serializable
data class ListToolsResult(
    val tools: List<Tool>,
    val nextCursor: String? = null
)

// ========== Initialize Types ==========

@Serializable
data class InitializeRequest(
    val protocolVersion: String,
    val capabilities: ClientCapabilities,
    val clientInfo: Implementation
)

@Serializable
data class InitializeResult(
    val protocolVersion: String,
    val capabilities: ServerCapabilities,
    val serverInfo: Implementation
)

@Serializable
data class Implementation(
    val name: String,
    val version: String
)

@Serializable
data class ClientCapabilities(
    val roots: RootsCapability? = null,
    val sampling: JsonObject? = null
)

@Serializable
data class ServerCapabilities(
    val logging: JsonObject? = null,
    val prompts: PromptsCapability? = null,
    val resources: ResourcesCapability? = null,
    val tools: ToolsCapability? = null
)

@Serializable
data class RootsCapability(
    val listChanged: Boolean = true
)

@Serializable
data class PromptsCapability(
    val listChanged: Boolean = true
)

@Serializable
data class ResourcesCapability(
    val subscribe: Boolean = true,
    val listChanged: Boolean = true
)

@Serializable
data class ToolsCapability(
    val listChanged: Boolean = true
)

// ========== Serializers ==========

object JSONRPCMessagePolymorphicSerializer : JsonContentPolymorphicSerializer<JSONRPCMessage>(JSONRPCMessage::class) {
    override fun selectDeserializer(element: JsonElement): DeserializationStrategy<JSONRPCMessage> {
        val obj = element.jsonObject
        return when {
            "id" in obj && "result" in obj || "error" in obj -> JSONRPCResponse.serializer()
            "id" in obj && "method" in obj -> JSONRPCRequest.serializer()
            "method" in obj -> JSONRPCNotification.serializer()
            else -> throw SerializationException("Unknown JSONRPCMessage type")
        }
    }
}

object RequestIdSerializer : KSerializer<RequestId> {
    override val descriptor = PrimitiveSerialDescriptor("RequestId", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: RequestId) {
        when (value) {
            is RequestId.NumberId -> encoder.encodeInt(value.value)
            is RequestId.StringId -> encoder.encodeString(value.value)
        }
    }

    override fun deserialize(decoder: Decoder): RequestId {
        val element = (decoder as JsonDecoder).decodeJsonElement()
        return when {
            element is JsonPrimitive && element.isString -> RequestId.StringId(element.content)
            element is JsonPrimitive -> RequestId.NumberId(element.int)
            else -> throw SerializationException("Invalid RequestId")
        }
    }
}
